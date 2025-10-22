import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      client_name,
      client_surname,
      building_number,
      apartment_number,
      apartment_type,
    } = body;

    // Validate required fields
    if (
      !client_name ||
      !client_surname ||
      !building_number ||
      !apartment_number ||
      !apartment_type
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Insert new apartment record
    const { data, error } = await supabase
      .from("apartments")
      .insert([
        {
          client_name,
          client_surname,
          building_number,
          unit_number: apartment_number,
          apartment_type,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error inserting apartment:", error);
      return NextResponse.json(
        { error: "Failed to create apartment", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Apartment created successfully", apartment: data });
  } catch (err: any) {
    console.error("Unexpected error creating apartment:", err);
    return NextResponse.json(
      { error: "Unexpected server error", detail: err.message },
      { status: 500 }
    );
  }
}
