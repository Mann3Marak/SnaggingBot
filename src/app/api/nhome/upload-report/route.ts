import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { file, fileName, sessionId } = await req.json();

    if (!file || !fileName || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const buffer = Buffer.from(file, "base64");
    const path = `reports/${sessionId}/${fileName}`;

    console.log("📤 Uploading report via API route:", path);

    const { error } = await supabase.storage
      .from("nhome-reports")
      .upload(path, buffer, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (error) {
      console.error("❌ Supabase upload failed:", error);
      throw error;
    }

    const { data: publicUrl } = supabase.storage
      .from("nhome-reports")
      .getPublicUrl(path);

    console.log("✅ Report uploaded successfully:", publicUrl.publicUrl);
    return NextResponse.json({ url: publicUrl.publicUrl });
  } catch (err: any) {
    console.error("❌ Upload failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
