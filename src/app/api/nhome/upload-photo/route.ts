import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;
    const fileName = formData.get("fileName") as string;
    const itemId = formData.get("itemId") as string | null;

    if (!file || !sessionId || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bucket = "nhome_photos";
    const path = `sessions/${sessionId}/${fileName}`;

    console.log(`📤 Uploading photo: ${path} for item: ${itemId || 'unknown'}`);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
      return NextResponse.json({ error: signedUrlError.message }, { status: 500 });
    }

    // ✅ Append the public URL to inspection_results.photo_urls for the specific item
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

    if (itemId) {
      // Update the specific inspection_result by session_id AND item_id
      const { data: existingResult, error: fetchError } = await supabase
        .from("inspection_results")
        .select("id, photo_urls")
        .eq("session_id", sessionId)
        .eq("item_id", itemId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching inspection_result:", fetchError);
      } else if (existingResult) {
        const currentUrls = Array.isArray(existingResult.photo_urls) ? existingResult.photo_urls : [];
        const updatedUrls = [...currentUrls, publicUrl];

        const { error: updateError } = await supabase
          .from("inspection_results")
          .update({ photo_urls: updatedUrls })
          .eq("id", existingResult.id);

        if (updateError) {
          console.error("Error updating inspection_results.photo_urls:", updateError);
        } else {
          console.log(`✅ Photo URL appended to inspection_result ${existingResult.id}`);
        }
      } else {
        console.warn(`⚠️ No inspection_result found for session ${sessionId} and item ${itemId}`);
      }
    } else {
      console.warn(`⚠️ No itemId provided, photo_urls not updated`);
    }

    console.log(`✅ Photo uploaded successfully: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      supabase_url: signedUrlData?.signedUrl,
      public_url: publicUrl,
      path,
    });
  } catch (err: any) {
    console.error("Upload API error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
