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

    if (!file || !sessionId || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bucket = "nhome_photos";
    const path = `sessions/${sessionId}/${fileName}`;

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

    // ✅ Append the public URL to inspection_results.photo_urls
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

    const { error: updateError } = await supabase.rpc("append_photo_url", {
      session_id_input: sessionId,
      photo_url_input: publicUrl,
    });

    if (updateError) {
      console.error("Error updating inspection_results.photo_urls:", updateError);
    }

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
