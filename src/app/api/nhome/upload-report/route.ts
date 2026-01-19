export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    console.log("✅ Report uploaded successfully:", urlWithCacheBuster);
    return NextResponse.json({ url: urlWithCacheBuster });
  } catch (err: any) {
    console.error("❌ Upload failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
