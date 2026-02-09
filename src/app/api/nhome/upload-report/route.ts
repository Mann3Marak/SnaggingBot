export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, createServiceClient } from "@/lib/server/apiAuth";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/server/rateLimit";

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
    const rateLimitResponse = await enforceRateLimit(
      req,
      {
        keyPrefix: "nhome-upload-report",
        windowMs: 10 * 60_000,
        max: 30,
      },
      { identifier: user.id }
    );
    if (rateLimitResponse) return rateLimitResponse;

    logger.info('[Upload Report] Uploading report', {
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

    logger.debug("[Upload Report] Uploading report blob", { path });

    const { error } = await supabase.storage
      .from("nhome_reports")
      .upload(path, buffer, {
        upsert: true,
        contentType: "application/pdf",
        cacheControl: "no-cache, no-store, must-revalidate",
      });

    if (error) {
      logger.error("[Upload Report] Supabase upload failed", { error: error.message });
      throw error;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("nhome_reports")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedError || !signedData?.signedUrl) {
      logger.error("[Upload Report] Failed to sign uploaded report", {
        path,
        error: signedError?.message ?? "No signed URL returned",
      });
      return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
    }

    logger.info('[Upload Report] Report uploaded successfully', {
      sessionId,
      userId: user.id,
      url: signedData.signedUrl,
    });

    return NextResponse.json({ url: signedData.signedUrl, path });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    logger.error("[Upload Report] Upload failed", {
      error: err.message,
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
