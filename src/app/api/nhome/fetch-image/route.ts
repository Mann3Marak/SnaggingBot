import { NextResponse } from "next/server";
import { NHomeOneDriveManager } from "@/lib/nhome-onedrive-manager";

/**
 * Secure server-side route to fetch SharePoint/OneDrive images via Microsoft Graph API.
 * This bypasses CORS and authentication redirects by using the authenticated Graph client.
 * 
 * Example usage:
 *   /api/nhome/fetch-image?url=https://nhome.sharepoint.com/Shared%20Documents/...
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  try {
    const manager = new NHomeOneDriveManager();
    const graphClient = (manager as any).graphClient;

    // Extract relative path from SharePoint URL (handle encoded spaces and nested folders)
    const url = decodeURIComponent(rawUrl);
    const baseMatch = url.match(/\/Shared\s?Documents\/(.*)$/i);
    const relativePath = baseMatch ? baseMatch[1].replace(/^\/+/, "") : null;

    if (!relativePath) {
      console.warn("Could not extract relative path from:", url);
      return NextResponse.json({ error: "Invalid SharePoint URL", url }, { status: 400 });
    }

    // Try both drive-relative and site-relative paths to handle different SharePoint structures
    const drivePath = manager["driveId"]
      ? `/drives/${manager["driveId"]}/root:/Shared Documents/${relativePath}:/content`
      : `/me/drive/root:/Shared Documents/${relativePath}:/content`;

    // Try multiple fallback paths for different SharePoint structures
    const sitePath = `/sites/${process.env.NEXT_PUBLIC_MS_SITE_ID || "nhome.sharepoint.com"}/drive/root:/Shared Documents/${relativePath}:/content`;
    const altPath = `/sites/${process.env.NEXT_PUBLIC_MS_SITE_ID || "nhome.sharepoint.com"}/drives/${manager["driveId"]}/root:/Shared Documents/${relativePath}:/content`;

    let response: any = null;
    const tryPaths = [
      drivePath,
      sitePath,
      altPath,
      `/sites/${process.env.NEXT_PUBLIC_MS_SITE_ID || "nhome.sharepoint.com"}/drive/root:/Documents/${relativePath}:/content`,
      `/sites/${process.env.NEXT_PUBLIC_MS_SITE_ID || "nhome.sharepoint.com"}/drive/root:/Shared%20Documents/${relativePath}:/content`,
      `/me/drive/root:/Documents/${relativePath}:/content`,
    ];

    for (const path of tryPaths) {
      try {
        console.log("Attempting Graph fetch:", path);
        response = await graphClient.api(path).get();
        if (response && response.body) break;
      } catch (err: any) {
        if (err?.code === "itemNotFound") {
          console.warn("Path not found:", path);
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!response || !response.body) {
      console.error("All Graph path attempts failed for:", relativePath);
      return NextResponse.json({ error: "Image not found in any known path", relativePath }, { status: 404 });
    }

    if (!response || !response.body) {
      return NextResponse.json({ error: "Failed to fetch image content" }, { status: 500 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType =
      rawUrl.toLowerCase().endsWith(".png")
        ? "image/png"
        : rawUrl.toLowerCase().endsWith(".gif")
        ? "image/gif"
        : "image/jpeg";

    return NextResponse.json({
      dataUri: `data:${mimeType};base64,${base64}`,
    });
  } catch (err: any) {
    console.error("Graph API image fetch error:", err);
    return NextResponse.json({ error: "Graph API fetch failed", details: err.message }, { status: 500 });
  }
}
