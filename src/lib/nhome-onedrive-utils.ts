import { NHomeOneDriveManager } from './nhome-onedrive-manager'

/**
 * Utility functions for OneDrive image fetching and authentication
 * used by the NHome report generation system.
 */

export async function getAccessToken(): Promise<string> {
  const manager = new NHomeOneDriveManager()
  // Access token is retrieved via internal auth provider
  const authProvider: any = (manager as any).graphClient?.config?.authProvider
  if (authProvider && typeof authProvider.getAccessToken === 'function') {
    return await authProvider.getAccessToken()
  }
  throw new Error('Unable to retrieve Microsoft Graph access token')
}

export async function fetchOneDriveImageAsBase64(url: string, accessToken: string): Promise<string> {
  try {
    // Convert SharePoint URL to Graph API endpoint
    const cleanUrl = decodeURIComponent(url)
    // Try multiple Graph API URL patterns for better compatibility
    const match = cleanUrl.match(/nhome\.sharepoint\.com\/.*?\/(Shared Documents\/.*)/i)
    if (!match) {
      console.warn("Could not parse SharePoint path, trying direct fetch")
      const res = await fetch(cleanUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`)
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      const contentType = res.headers.get("content-type") || "image/jpeg"
      return `data:${contentType};base64,${base64}`
    }

    const relativePath = match[1]
    const graphUrls = [
      `https://graph.microsoft.com/v1.0/sites/root/drive/root:/${relativePath}:/content`,
      `https://graph.microsoft.com/v1.0/sites/nhome.sharepoint.com/drive/root:/${relativePath}:/content`,
      `https://graph.microsoft.com/v1.0/me/drive/root:/${relativePath}:/content`,
    ]

    for (const graphUrl of graphUrls) {
      try {
        const response = await fetch(graphUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          const base64 = Buffer.from(arrayBuffer).toString("base64")
          const contentType = response.headers.get("content-type") || "image/jpeg"
          return `data:${contentType};base64,${base64}`
        }
      } catch (e) {
        console.warn("Graph URL failed:", graphUrl)
      }
    }

    throw new Error("All Graph API fetch attempts failed")
  } catch (err) {
    console.warn("Graph API image fetch failed:", err)
    throw err
  }
}
