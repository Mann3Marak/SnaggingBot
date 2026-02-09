import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, createServiceClient } from "@/lib/server/apiAuth";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;
    const fileName = formData.get("fileName") as string;
    const itemId = formData.get("itemId") as string | null;

    if (!file || !sessionId || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user owns the session or is admin
    const { user, profile } = await requireOwnership(req, {
      type: "session",
      resourceId: sessionId,
    });
    const rateLimitResponse = await enforceRateLimit(
      req,
      {
        keyPrefix: "nhome-upload-photo",
        windowMs: 60_000,
        max: 120,
      },
      { identifier: user.id }
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Use service role for storage operations (required for storage API)
    const adminClient = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const bucket = "nhome_photos";
    const path = `sessions/${sessionId}/${fileName}`;

    logger.info("[Upload Photo] Uploading photo", {
      path,
      itemId: itemId || 'unknown',
      sessionId,
      userId: user.id,
    });

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      logger.error("[Upload Photo] Supabase upload error", {
        error: uploadError.message,
        sessionId,
        userId: user.id,
      });
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signedUrlError) {
      logger.error("[Upload Photo] Signed URL error", {
        error: signedUrlError.message,
        sessionId,
        userId: user.id,
      });
      return NextResponse.json({ error: signedUrlError.message }, { status: 500 });
    }

    // NOTE: photo_urls is synchronized from nhome_photos metadata persistence/trigger path.
    // This upload route only handles blob storage.

    logger.info("[Upload Photo] Photo uploaded successfully", {
      path,
      sessionId,
      userId: user.id,
      companyId: profile.company_id,
    });

    return NextResponse.json({
      success: true,
      supabase_url: signedUrlData?.signedUrl,
      path,
    });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    logger.error("[Upload Photo] Upload API error", {
      error: err.message,
    });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
