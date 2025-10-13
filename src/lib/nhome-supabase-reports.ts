import { getSupabase } from "@/lib/supabase";

/**
 * Uploads a generated NHome report (PDF) to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadNHomeReportToSupabase(
  fileBlob: Blob,
  fileName: string,
  sessionId: string
): Promise<string> {
  // Use service role key for admin-level access (bypasses RLS)
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials. Available keys:", {
      hasUrl: !!supabaseUrl,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    throw new Error("supabaseKey is required.");
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  console.log("✅ Using Supabase key:", supabaseKey.slice(0, 10) + "...");

  // Convert file to base64 and send to server API route for upload
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(fileBlob);
  });

  console.log("📤 Sending report to server API for upload:", fileName);

  const response = await fetch("/api/nhome/upload-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: base64, fileName, sessionId }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("❌ Server upload failed:", result.error);
    throw new Error(`Failed to upload report: ${result.error}`);
  }

  console.log("✅ Report uploaded successfully via API:", result.url);
  return result.url;
}
