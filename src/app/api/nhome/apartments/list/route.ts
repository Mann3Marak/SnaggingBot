import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("apartments")
      .select("id, unit_number, apartment_type, building_number")
      .eq("project_id", projectId)
      .order("unit_number", { ascending: true });

    if (error) {
      console.error("Error fetching apartments:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ apartments: data || [] }, { status: 200 });
  } catch (err: any) {
    console.error("Unexpected error fetching apartments:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
