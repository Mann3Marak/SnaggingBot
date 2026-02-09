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

const BUCKET_ID = 'nhome_photos'

export class NHomePhotoUploadService {
  async uploadNHomeInspectionPhoto(
    blob: Blob,
    metadata: NHomePhotoMetadata,
    sessionId: string,
    itemId: string,
    fileName: string,
    session?: NHomeSessionContext,
    onProgress?: (p: number) => void,
  ): Promise<{ success: boolean; supabase_url?: string; photo?: any; error?: string }> {
    try {
      // Ensure Supabase client session is available (fetch relies on active auth cookies)
      getSupabase()

      const formData = new FormData()
      formData.append('file', blob)
      formData.append('sessionId', sessionId)
      formData.append('fileName', fileName)
      if (itemId) {
        formData.append('itemId', itemId)
      }

      const uploadResponse = await fetch('/api/nhome/upload-photo', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`Upload API failed: ${errorText}`)
      }

      const uploadPayload = await uploadResponse.json().catch(() => ({}))
      const supabaseUrl = uploadPayload?.supabase_url as string | undefined
      onProgress?.(100)

      const metadataResponse = await fetch(`/api/nhome/inspections/${sessionId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          file_name: fileName,
          storage_url: supabaseUrl,
          supabase_url: supabaseUrl,
          metadata,
        }),
      })

      let persistedPhoto: any = null
      if (metadataResponse.ok) {
        const metaPayload = await metadataResponse.json().catch(() => null)
        persistedPhoto = metaPayload?.photo ?? null
      } else {
        const errorText = await metadataResponse.text().catch(() => '')
        console.warn(
          '[NHomePhotoUploadService] Metadata persistence failed',
          metadataResponse.status,
          errorText,
        )
      }

      return { success: true, supabase_url: supabaseUrl, photo: persistedPhoto }
    } catch (e: any) {
      console.error('NHome upload failed', e)
      if (onProgress) onProgress(0)
      return { success: false, error: e?.message || 'upload_failed' }
    }
  }

  async shareInspectionWithClient(
    sessionId: string,
    session?: NHomeSessionContext,
  ): Promise<{ success: boolean; package_url?: string; error?: string }> {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase.storage
        .from(BUCKET_ID)
        .list(`sessions/${sessionId}`, { limit: 100 })

      if (error) throw error

      const signedUrls = await Promise.all(
        (data ?? []).map(async (f: any) => {
          const { data: signed } = await supabase.storage
            .from(BUCKET_ID)
            .createSignedUrl(`sessions/${sessionId}/${f.name}`, 60 * 60 * 24 * 7)
          return {
            name: f.name,
            url: signed?.signedUrl ?? null,
          }
        })
      )
      const validUrls = signedUrls.filter((entry) => Boolean(entry.url))

      console.log(
        `Shared inspection package for session ${sessionId}:`,
        validUrls.length,
        'files',
      )

      // This endpoint currently returns a single link for compatibility.
      // Use the first signed file URL if available.
      return { success: true, package_url: validUrls[0]?.url ?? undefined }
    } catch (e: any) {
      console.error('Failed to share inspection with client', e)
      return { success: false, error: e?.message || 'share_failed' }
    }
  }
}
