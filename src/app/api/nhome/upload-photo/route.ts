import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, createServiceClient } from "@/lib/server/apiAuth";

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

    // Use service role for storage operations (required for storage API)
    const adminClient = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const bucket = "nhome_photos";
    const path = `sessions/${sessionId}/${fileName}`;

    console.info("[Upload Photo] Uploading photo", {
      path,
      itemId: itemId || 'unknown',
      sessionId,
      userId: user.id,
    });

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("[Upload Photo] Supabase upload error", {
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
      console.error("[Upload Photo] Signed URL error", {
        error: signedUrlError.message,
        sessionId,
        userId: user.id,
      });
      return NextResponse.json({ error: signedUrlError.message }, { status: 500 });
    }

    // Append the public URL to inspection_results.photo_urls for the specific item
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

    if (itemId) {
      // Update the specific inspection_result by session_id AND item_id
      const { data: existingResult, error: fetchError } = await adminClient
        .from("inspection_results")
        .select("id, photo_urls")
        .eq("session_id", sessionId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (fetchError) {
        console.error("[Upload Photo] Error fetching inspection_result", {
          error: fetchError.message,
          sessionId,
          itemId,
          userId: user.id,
        });
      } else if (existingResult) {
        const currentUrls = Array.isArray(existingResult.photo_urls) ? existingResult.photo_urls : [];
        const updatedUrls = [...currentUrls, publicUrl];

        const { error: updateError } = await adminClient
          .from("inspection_results")
          .update({ photo_urls: updatedUrls })
          .eq("id", existingResult.id);

        if (updateError) {
          console.error("[Upload Photo] Error updating inspection_results.photo_urls", {
            error: updateError.message,
            resultId: existingResult.id,
            userId: user.id,
          });
        } else {
          console.info("[Upload Photo] Photo URL appended to inspection_result", {
            resultId: existingResult.id,
            sessionId,
            userId: user.id,
          });
        }
      } else {
        console.warn("[Upload Photo] No inspection_result found", {
          sessionId,
          itemId,
          userId: user.id,
        });
      }
    } else {
      console.warn("[Upload Photo] No itemId provided, photo_urls not updated", {
        sessionId,
        userId: user.id,
      });
    }

    console.info("[Upload Photo] Photo uploaded successfully", {
      publicUrl,
      sessionId,
      userId: user.id,
      companyId: profile.company_id,
    });

    return NextResponse.json({
      success: true,
      supabase_url: signedUrlData?.signedUrl,
      public_url: publicUrl,
      path,
    });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    console.error("[Upload Photo] Upload API error", {
      error: err.message,
    });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
