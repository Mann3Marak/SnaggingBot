export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, createServiceClient } from "@/lib/server/apiAuth";

export async function POST(req: NextRequest) {
  try {
    const { file, fileName, sessionId } = await req.json();

    if (!file || !fileName || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user owns the session or is admin
    const { user } = await requireOwnership(req, {
      type: "session",
      resourceId: sessionId,
    });

    console.info('[Upload Report] Uploading report', {
      sessionId,
      fileName,
      userId: user.id,
    });

    // Use service role for storage operations (required for storage API)
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const buffer = Buffer.from(file, "base64");
    // Use fixed filenames to ensure overwriting existing reports
    const isEnglish = fileName.toLowerCase().includes("english");
    const isPortuguese = fileName.toLowerCase().includes("relatorio") || fileName.toLowerCase().includes("portuguese");
    const fixedName = isEnglish ? "english.pdf" : isPortuguese ? "portuguese.pdf" : fileName;
    const path = `reports/${sessionId}/${fixedName}`;

    console.log("📤 Uploading report via API route:", path);

    const { error } = await supabase.storage
      .from("nhome_reports")
      .upload(path, buffer, {
        upsert: true,
        contentType: "application/pdf",
        cacheControl: "no-cache, no-store, must-revalidate",
      });

    if (error) {
      console.error("❌ Supabase upload failed:", error);
      throw error;
    }

    const { data: publicUrl } = supabase.storage
      .from("nhome_reports")
      .getPublicUrl(path);

    // Add cache-busting timestamp to URL
    const urlWithCacheBuster = `${publicUrl.publicUrl}?t=${Date.now()}`;

    console.info('[Upload Report] Report uploaded successfully', {
      sessionId,
      userId: user.id,
      url: urlWithCacheBuster,
    });

    return NextResponse.json({ url: urlWithCacheBuster });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    console.error("[Upload Report] Upload failed", {
      error: err.message,
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
