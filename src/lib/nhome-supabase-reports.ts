/**
 * Uploads a generated NHome report (PDF) to Supabase Storage.
 * Returns a signed URL returned by the secured API route.
 */
export async function uploadNHomeReportToSupabase(
  fileBlob: Blob,
  fileName: string,
  sessionId: string
): Promise<{ url: string; path: string }> {
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
  return { url: result.url, path: result.path };
}
