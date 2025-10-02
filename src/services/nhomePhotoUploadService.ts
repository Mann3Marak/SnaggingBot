import { NHomeOneDriveManager } from '@/lib/nhome-onedrive-manager'
import type { NHomePhotoMetadata } from '@/types/nhome-photo'

type NHomeSessionContext = {
  status?: string
  project?: { name?: string; developer_name?: string | null }
  apartment?: { unit_number?: string | number | null }
  scheduled_date?: string | null
  inspection_date?: string | null
  created_at?: string | null
}

export class NHomePhotoUploadService {
  private manager = new NHomeOneDriveManager()
  private folderCache = new Map<string, string>()

  async shareInspectionWithClient(
    sessionId: string,
    session?: NHomeSessionContext,
    clientEmail?: string,
  ): Promise<string> {
    const folderPath = await this.resolveSessionFolder(sessionId, undefined, session)
    return this.manager.shareNHomeFolderWithClient(folderPath, clientEmail)
  }

  async uploadNHomeInspectionPhoto(
    blob: Blob,
    metadata: NHomePhotoMetadata,
    sessionId: string,
    itemId: string,
    fileName: string,
    session?: NHomeSessionContext,
    onProgress?: (p: number) => void,
  ): Promise<{ success: boolean; onedrive_url?: string; folder_path?: string; error?: string }> {
    try {
      console.debug('NHome upload -> resolve target', { sessionId, itemId, fileName })
      const folderPath = await this.resolveSessionFolder(sessionId, metadata, session)
      const onedriveUrl = await this.manager.uploadNHomePhoto(
        blob,
        metadata,
        folderPath,
        fileName,
        onProgress,
      )
      onProgress?.(100)

      try {
        await fetch(`/api/nhome/inspections/${sessionId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: itemId,
            file_name: fileName,
            onedrive_url: onedriveUrl,
            metadata,
            folder_path: folderPath,
          }),
        })
      } catch (persistErr) {
        console.warn('Failed to persist NHome photo metadata', persistErr)
      }

      return { success: true, onedrive_url: onedriveUrl, folder_path: folderPath }
    } catch (e: any) {
      console.error('NHome upload failed', e)
      if (onProgress) onProgress(0)
      return { success: false, error: e?.message || 'upload_failed' }
    }
  }

  private async resolveSessionFolder(
    sessionId: string,
    metadata?: NHomePhotoMetadata,
    session?: NHomeSessionContext,
  ): Promise<string> {
    const cached = this.folderCache.get(sessionId)
    if (cached) return cached

    const clientName =
      session?.project?.developer_name?.trim() ||
      metadata?.company?.trim() ||
      metadata?.property?.trim() ||
      'NHome Clients'

    const propertyName =
      session?.project?.name?.trim() ||
      metadata?.property?.trim() ||
      'Property'

    const apartmentUnit =
      (session?.apartment?.unit_number ?? metadata?.unit ?? 'Unit').toString().trim() ||
      'Unit'

    const inspectionDate = this.formatDate(
      metadata?.timestamp ||
        session?.inspection_date ||
        session?.scheduled_date ||
        session?.created_at ||
        new Date().toISOString(),
    )

    const inspectionType = session?.status === 'followup' ? 'followup' : 'initial'

    const folderPath = await this.manager.createNHomeFolderStructure(
      clientName,
      propertyName,
      apartmentUnit,
      inspectionDate,
      inspectionType,
    )

    this.folderCache.set(sessionId, folderPath)
    return folderPath
  }

  private formatDate(input?: string | null): string {
    if (!input) return this.formatDate(new Date().toISOString())
    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().split('T')[0]
    }
    return parsed.toISOString().split('T')[0]
  }
}
