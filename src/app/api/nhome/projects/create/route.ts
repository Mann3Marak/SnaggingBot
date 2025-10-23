import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          name: body.name,
          developer_name: body.developer_name,
          developer_contact_email: body.developer_contact_email || null,
          developer_contact_phone: body.developer_contact_phone || null,
          address: body.address,
          apartment_types: body.apartment_types || [],
          building_numbers: body.building_numbers || [],
          created_by: body.created_by || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error inserting project:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ project: data }, { status: 200 });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
