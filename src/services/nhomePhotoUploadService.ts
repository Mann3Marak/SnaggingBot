"use client"
import { NHomeOneDriveManager } from '@/lib/nhome-onedrive-manager'
import { getSupabase } from '@/lib/supabase'

export interface NHomePhotoUploadResult {
  success: boolean
  onedrive_url?: string
  error?: string
  folder_path?: string
}

export class NHomePhotoUploadService {
  private oneDrive: NHomeOneDriveManager
  constructor() {
    this.oneDrive = new NHomeOneDriveManager()
  }

  async uploadNHomeInspectionPhoto(
    photoBlob: Blob,
    metadata: any,
    sessionId: string,
    itemId: string,
    fileName: string,
    onProgress?: (progress: number) => void,
  ): Promise<NHomePhotoUploadResult> {
    try {
      const supabase = getSupabase()
      const { data: sessionData } = await supabase
        .from('inspection_sessions')
        .select(`*, apartments (*, projects (*)), users (full_name, email)`).eq('id', sessionId).single()
      if (!sessionData) throw new Error('Inspection session not found')

      const inspectionDate = new Date(sessionData.started_at ?? new Date()).toISOString().split('T')[0]
      const folderPath = await this.oneDrive.createNHomeFolderStructure(
        sessionData.apartments?.projects?.developer_name ?? 'Client',
        sessionData.apartments?.projects?.name ?? 'Property',
        sessionData.apartments?.unit_number ?? 'Unit',
        inspectionDate,
        'initial',
      )

      const onedrive_url = await this.oneDrive.uploadNHomePhoto(
        photoBlob,
        metadata,
        folderPath,
        fileName,
        onProgress,
      )

      await this.saveNHomePhotoRecord(sessionId, itemId, fileName, onedrive_url, folderPath, metadata, photoBlob)

      return { success: true, onedrive_url, folder_path: folderPath }
    } catch (e: any) {
      console.error('NHome photo upload error:', e)
      return { success: false, error: e?.message ?? 'Upload failed' }
    }
  }

  private async saveNHomePhotoRecord(
    sessionId: string,
    itemId: string,
    fileName: string,
    onedrive_url: string,
    folderPath: string,
    metadata: any,
    blob: Blob,
  ) {
    const dims = metadata?.dimensions || ''
    const supabase = getSupabase()
    await supabase.from('nhome_inspection_photos').insert({
      session_id: sessionId,
      item_id: itemId,
      file_name: fileName,
      onedrive_url,
      folder_path: folderPath,
      metadata,
      company: 'NHome Property Setup & Management',
      location: 'Algarve, Portugal',
      uploaded_at: new Date().toISOString(),
      file_size: blob.size,
      image_dimensions: dims,
      professional_watermark: true,
    })
  }
}

