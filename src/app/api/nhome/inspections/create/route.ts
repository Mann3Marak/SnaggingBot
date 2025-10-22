import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { project_id, apartment_id } = await req.json();

    if (!project_id || !apartment_id) {
      return NextResponse.json(
        { error: "Missing project_id or apartment_id" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("inspection_sessions")
      .insert([
        {
          apartment_id,
          status: "in_progress",
          started_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("Error creating inspection session:", error);
      return NextResponse.json(
        { error: "Failed to create inspection session", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: data.id });
  } catch (err: any) {
    console.error("Unexpected error creating inspection session:", err);
    return NextResponse.json(
      { error: "Unexpected server error", detail: err.message },
      { status: 500 }
    );
  }
}
