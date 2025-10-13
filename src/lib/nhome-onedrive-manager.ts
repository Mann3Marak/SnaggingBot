import { Client } from '@microsoft/microsoft-graph-client'

// Lightweight copy of our photo metadata to avoid circular imports
export interface NHomePhotoMetadata {
  inspector: string
  company: string
  property: string
  unit: string
  room: string
  item: string
  timestamp: string
  location: string
  quality_standards: string
}

class NHomeAuthProvider {
  async getAccessToken(): Promise<string> {
    const response = await fetch('/api/auth/nhome-microsoft-token', {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Failed to get Microsoft access token for NHome')
    const { access_token } = await response.json()
    if (!access_token) throw new Error('Missing Microsoft access token')
    return access_token as string
  }
}

export class NHomeOneDriveManager {
  private graphClient: Client
  private driveId: string | undefined = process.env.NEXT_PUBLIC_MS_DRIVE_ID
  private companyInfo = {
    name: 'NHome Property Setup & Management',
    founder: "Natalie O'Kelly",
    location: 'Algarve, Portugal',
    website: 'https://www.nhomesetup.com',
  }

  constructor() {
    this.graphClient = Client.initWithMiddleware({ authProvider: new NHomeAuthProvider() })
  }

  private cleanFolderName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim()
  }

    private async ensureFolderExists(folderPath: string) {
    try {
      const base = this.driveId ? `/drives/${this.driveId}/root:/${folderPath}:/` : `/me/drive/root:/${folderPath}:/`
      await this.graphClient.api(base).get()
      return
    } catch (error: any) {
      // Automatically create root folder if missing
      const isRootMissing = folderPath === "NHome_Professional_Inspections" || folderPath === "/NHome_Professional_Inspections";
      if (isRootMissing) {
        const rootCreatePath = this.driveId
          ? `/drives/${this.driveId}/root/children`
          : `/me/drive/root/children`;
        try {
          await this.graphClient.api(rootCreatePath).post({
            name: "NHome_Professional_Inspections",
            folder: {},
            "@microsoft.graph.conflictBehavior": "rename",
          });
          return;
        } catch (rootError) {
          console.warn("Failed to auto-create root folder:", rootError);
        }
      }
      const code = error?.code || error?.body?.error?.code
      const status = error?.statusCode || error?.status
      const isNotFound = code === 'itemNotFound' || status === 404 || (typeof error?.message === 'string' && error.message.includes('itemNotFound'))
      if (!isNotFound) throw error

      const parts = folderPath.split('/')
      let folderName = parts.pop() as string
      const parentPath = parts.join('/')

      // Fallback for missing or invalid folder names
      if (!folderName || folderName.trim() === '') {
        folderName = 'Unnamed_Folder'
      }

      // Ensure parent exists recursively
      if (parentPath) {
        await this.ensureFolderExists(parentPath)
      }

      const createPath = this.driveId
        ? (parentPath ? `/drives/${this.driveId}/root:/${parentPath}:/children` : `/drives/${this.driveId}/root/children`)
        : (parentPath ? `/me/drive/root:/${parentPath}:/children` : '/me/drive/root/children')

      try {
        // If root folder doesn't exist, create it directly
        if (!parentPath) {
          await this.graphClient.api(createPath).post({
            name: folderName || "NHome_Professional_Inspections",
            folder: {},
            "@microsoft.graph.conflictBehavior": "rename",
          });
          return;
        }

        await this.graphClient.api(createPath).post({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "replace",
        });
      } catch (e: any) {
        // Ignore if someone else created it in the meantime
        const c = e?.code || e?.body?.error?.code;
        if (c !== "nameAlreadyExists") throw e;
      }
    }
  }

  async createNHomeFolderStructure(
    clientName: string,
    propertyName: string,
    apartmentUnit: string,
    inspectionDate: string,
    inspectionType: 'initial' | 'followup' = 'initial',
  ): Promise<string> {
    const cleanClientName = this.cleanFolderName(clientName)
    const cleanPropertyName = this.cleanFolderName(propertyName)
    const cleanUnit = this.cleanFolderName(apartmentUnit)

    const root = 'NHome_Professional_Inspections'
    const basePath = `/${root}/${cleanClientName}/${cleanPropertyName}/Unit_${cleanUnit}`
    const fullPath = `${basePath}/${inspectionDate}_${inspectionType === 'initial' ? 'Initial_Inspection' : 'Follow_Up_Inspection'}`

    // Ensure parents
    await this.ensureFolderExists(root)
    await this.ensureFolderExists(`${root}/${cleanClientName}`)
    await this.ensureFolderExists(`${root}/${cleanClientName}/${cleanPropertyName}`)
    await this.ensureFolderExists(basePath.substring(1))
    await this.ensureFolderExists(fullPath.substring(1))

    // Subfolders
    const subfolders = ['Photos_by_Room', 'Photos_by_Issue_Type', 'Professional_Reports', 'Client_Documentation']
    for (const sub of subfolders) {
      await this.ensureFolderExists(`${fullPath}/${sub}`.substring(1))
    }

    // Seed documentation file
    await this.createNHomeDocumentationFile(fullPath, {
      client: clientName,
      property: propertyName,
      unit: apartmentUnit,
      inspection_date: inspectionDate,
      inspection_type: inspectionType,
    })

    return fullPath.substring(1)
  }

  async uploadNHomePhoto(
    photoBlob: Blob,
    metadata: NHomePhotoMetadata,
    folderPath: string,
    fileName: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const subfolder = `Photos_by_Room/${metadata.room.replace(/\s+/g, '_')}`
    const fullPath = `/${folderPath}/${subfolder}/${fileName}`

    let webUrl = ''
    if (photoBlob.size > 4 * 1024 * 1024) {
      webUrl = await this.resumableUpload(photoBlob, fullPath, onProgress)
    } else {
      const path = this.driveId ? `/drives/${this.driveId}/root:${fullPath}:/content` : `/me/drive/root:${fullPath}:/content`
      const result = await this.graphClient.api(path).put(photoBlob)
      webUrl = result.webUrl
    }

    await this.addNHomeMetadataToFile(fullPath, metadata)
    return webUrl
  }

  private async resumableUpload(file: Blob, path: string, onProgress?: (p: number) => void): Promise<string> {
    const createPath = this.driveId ? `/drives/${this.driveId}/root:${path}:/createUploadSession` : `/me/drive/root:${path}:/createUploadSession`
    const session = await this.graphClient.api(createPath).post({
      item: { '@microsoft.graph.conflictBehavior': 'replace', name: path.split('/').pop() },
    })
    const uploadUrl: string = session.uploadUrl
    const chunkSize = 320 * 1024
    let start = 0
    let response: Response | null = null
    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
          'Content-Length': `${chunk.size}`,
        },
        body: chunk,
      })
      if (onProgress) onProgress((end / file.size) * 100)
      start = end
    }
    const result = await (response as Response).json()
    return result.webUrl
  }

  private async addNHomeMetadataToFile(filePath: string, metadata: NHomePhotoMetadata) {
    try {
      const metaPath = this.driveId ? `/drives/${this.driveId}/root:${filePath}` : `/me/drive/root:${filePath}`
      await this.graphClient.api(metaPath).patch({
        description: `NHome Professional Inspection Photo - ${metadata.property}, Unit ${metadata.unit}, ${metadata.room}: ${metadata.item}. Taken by ${metadata.inspector} on ${new Date(metadata.timestamp).toLocaleDateString()}. ${this.companyInfo.name}, ${this.companyInfo.location}.`,
      })
    } catch (e) {
      // Non-fatal
      console.warn('Failed to set OneDrive file metadata')
    }
  }

  private async createNHomeDocumentationFile(folderPath: string, info: any) {
    const content = `# NHome Professional Inspection Documentation\n\n## Company Information\n- **Company:** ${this.companyInfo.name}\n- **Founder:** ${this.companyInfo.founder}\n- **Location:** ${this.companyInfo.location}\n- **Website:** ${this.companyInfo.website}\n\n## Inspection Details\n- **Client:** ${info.client}\n- **Property:** ${info.property}\n- **Unit:** ${info.unit}\n- **Inspection Date:** ${info.inspection_date}\n- **Inspection Type:** ${info.inspection_type}\n\n## Folder Organization\n- **Photos_by_Room**\n- **Photos_by_Issue_Type**\n- **Professional_Reports**\n- **Client_Documentation**\n\n*Generated automatically by NHome Inspection Pro*`.trim()
    try {
      const blob = new Blob([content], { type: 'text/markdown' })
      const docPath = this.driveId ? `/drives/${this.driveId}/root:${folderPath}/NHome_Inspection_Documentation.md:/content` : `/me/drive/root:${folderPath}/NHome_Inspection_Documentation.md:/content`
      await this.graphClient.api(docPath).put(blob)
    } catch (e) {
      console.warn('Failed to create documentation file')
    }
  }

  async shareNHomeFolderWithClient(folderPath: string, clientEmail?: string): Promise<string> {
    const linkPath = this.driveId ? `/drives/${this.driveId}/root:/${folderPath}:/createLink` : `/me/drive/root:/${folderPath}:/createLink`
    const link = await this.graphClient.api(linkPath).post({ type: 'view', scope: 'organization' })
    if (clientEmail) {
      try {
        const invitePath = this.driveId ? `/drives/${this.driveId}/root:/${folderPath}:/invite` : `/me/drive/root:/${folderPath}:/invite`
        await this.graphClient.api(invitePath).post({
          recipients: [{ email: clientEmail }],
          message: 'NHome Professional Inspection documentation is available for review.',
          requireSignIn: false,
          sendInvitation: true,
          roles: ['read'],
        })
      } catch {}
    }
    return link.webUrl
  }

  // Generic uploader for any Blob (e.g., PDFs). Returns the OneDrive webUrl.
  async uploadPhoto(
    fileBlob: Blob,
    fileName: string,
    folderPath: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const cleanName = this.cleanFolderName(fileName)
    await this.ensureFolderExists(folderPath)
    let fullPath = `/${folderPath}/${cleanName}`

    // Normalize path to remove duplicate slashes
    fullPath = fullPath.replace(/\/{2,}/g, "/")

    console.log("📤 Uploading file to OneDrive:", {
      folderPath,
      fileName: cleanName,
      size: fileBlob?.size,
      driveId: this.driveId || "default",
      fullPath,
    });

    if (!fileBlob || fileBlob.size === 0) {
      throw new Error(`Invalid or empty file blob for ${fileName}`);
    }

    try {
      if (fileBlob.size > 4 * 1024 * 1024) {
        console.log("Using resumable upload for large file:", cleanName);
        const url = await this.resumableUpload(fileBlob, fullPath, onProgress);
        console.log("✅ Resumable upload complete:", url);
        return url;
      }

      const path = this.driveId
        ? `/drives/${this.driveId}/root:${fullPath}:/content`
        : `/me/drive/root:${fullPath}:/content`;

      console.log("Uploading via direct PUT:", path);
      const result = await this.graphClient.api(path).put(fileBlob);
      console.log("✅ Upload successful:", result.webUrl);
      return result.webUrl;
    } catch (uploadError: any) {
      console.error("❌ OneDrive upload failed:", {
        message: uploadError?.message,
        code: uploadError?.code,
        body: uploadError?.body,
        stack: uploadError?.stack,
      });
      throw uploadError;
    }
  }
}
