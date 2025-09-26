export class NHomePhotoUploadService {
  // Placeholder implementation. Replace with real OneDrive integration.
  async shareInspectionWithClient(sessionId: string): Promise<string> {
    return `onedrive://share-link/${sessionId}`
  }

  async uploadNHomeInspectionPhoto(
    blob: Blob,
    metadata: any,
    sessionId: string,
    itemId: string,
    fileName: string,
    onProgress?: (p: number) => void,
  ): Promise<{ success: boolean; onedrive_url?: string; error?: string }> {
    // Simulate progress and return a placeholder OneDrive URL.
    try {
      if (onProgress) onProgress(10)
      await new Promise((r) => setTimeout(r, 150))
      if (onProgress) onProgress(45)
      await new Promise((r) => setTimeout(r, 150))
      if (onProgress) onProgress(85)
      await new Promise((r) => setTimeout(r, 100))
      if (onProgress) onProgress(100)
      const safeName = encodeURIComponent(fileName || 'photo.jpg')
      return { success: true, onedrive_url: `https://onedrive.example/${sessionId}/${itemId}/${safeName}` }
    } catch (e: any) {
      if (onProgress) onProgress(0)
      return { success: false, error: e?.message || 'upload_failed' }
    }
  }
}
