export class NHomePhotoUploadService {
  async shareInspectionWithClient(sessionId: string, clientEmail?: string): Promise<string> {
    try {
      const response = await fetch('/api/nhome/photos/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clientEmail }),
      })
      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        throw new Error(details?.error || 'share_failed')
      }
      const payload = await response.json()
      return payload.shareUrl as string
    } catch (error) {
      console.error('NHome share creation failed:', error)
      return `/inspection/share/${sessionId}`
    }
  }
  async uploadNHomeInspectionPhoto(
    blob: Blob,
    metadata: any,
    sessionId: string,
    itemId: string,
    fileName: string,
    onProgress?: (p: number) => void,
  ): Promise<{ success: boolean; onedrive_url?: string; error?: string }> {
    try {
      onProgress?.(15)
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('sessionId', sessionId)
      formData.append('itemId', itemId)
      formData.append('fileName', fileName)
      formData.append('metadata', JSON.stringify(metadata ?? {}))

      const response = await fetch('/api/nhome/photos/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        throw new Error(details?.error || 'upload_failed')
      }

      const payload = await response.json()
      onProgress?.(100)
      return { success: true, onedrive_url: payload.onedrive_url as string }
    } catch (error: any) {
      console.error('NHome photo upload failed:', error)
      onProgress?.(0)
      return { success: false, error: error?.message || 'upload_failed' }
    }
  }
}

