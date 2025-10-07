import { getSupabase } from '@/lib/supabase'
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
  async uploadNHomeInspectionPhoto(
    blob: Blob,
    metadata: NHomePhotoMetadata,
    sessionId: string,
    itemId: string,
    fileName: string,
    session?: NHomeSessionContext,
    onProgress?: (p: number) => void,
  ): Promise<{ success: boolean; supabase_url?: string; error?: string }> {
    try {
      const supabase = getSupabase()
      const path = `sessions/${sessionId}/${fileName}`

      const bucket = 'nhome-inspection-photos'
      // ✅ Use server-side API route to bypass RLS
      const formData = new FormData()
      formData.append("file", blob)
      formData.append("sessionId", sessionId)
      formData.append("fileName", fileName)

      const uploadResponse = await fetch("/api/nhome/upload-photo", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Upload API failed: ${errorText}`)
      }

      const { supabase_url: supabaseUrl } = await uploadResponse.json()
      onProgress?.(100)

      // ✅ Persist metadata after successful upload
      await fetch(`/api/nhome/inspections/${sessionId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          file_name: fileName,
          onedrive_url: supabaseUrl,
          metadata,
          folder_path: `sessions/${sessionId}/${fileName}`,
        }),
      })

      return { success: true, supabase_url: supabaseUrl }
    } catch (e: any) {
      console.error('NHome upload failed', e)
      if (onProgress) onProgress(0)
      return { success: false, error: e?.message || 'upload_failed' }
    }
  }
}
