import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, full_name")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user role:", error);
      return NextResponse.json({ error: "Failed to fetch user role" }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err: any) {
    console.error("Unexpected error fetching user role:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
