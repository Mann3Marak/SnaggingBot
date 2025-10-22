import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const body = await req.json();
    const { item_id, file_name, storage_url, supabase_url, metadata, file_size, image_dimensions } = body;

    if (!item_id || !file_name || !storage_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✅ Always use the sessionId from the URL, not from the client payload
    const { data, error } = await supabase
      .from("nhome_inspection_photos")
      .insert([
        {
          session_id: sessionId, // enforce correct session linkage
          item_id,
          file_name,
          folder_path: `session/${sessionId}`, // ✅ required non-null field
          supabase_url: supabase_url || `/sessions/${sessionId}/${file_name}`,
          metadata: metadata || {},
          file_size,
          image_dimensions,
        },
      ])
      .select()
      .single();

    console.log(`📸 Photo uploaded for session ${sessionId}: ${file_name}`);

    if (error) {
      console.error("DB insert error:", error);
      return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
    }

    return NextResponse.json({ success: true, photo: data });
  } catch (err: any) {
    console.error("Photo API error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
