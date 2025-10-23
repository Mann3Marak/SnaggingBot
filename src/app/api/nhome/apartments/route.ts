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
      project_id,
    } = body;

    // Validate required fields
    if (
      !client_name ||
      !client_surname ||
      !building_number ||
      !apartment_number ||
      !apartment_type ||
      !project_id
    ) {
      return NextResponse.json(
        { error: "Missing required fields (project_id required)" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Normalize apartment number by removing spaces and trimming
    const normalizedApartmentNumber = apartment_number.replace(/\s+/g, "").trim();

    // Check if apartment already exists in the same project and building
    const { data: existing, error: checkError } = await supabase
      .from("apartments")
      .select("id")
      .eq("project_id", project_id)
      .eq("building_number", building_number)
      .ilike("unit_number", normalizedApartmentNumber);

    if (checkError) {
      console.error("Error checking for existing apartment:", checkError);
      return NextResponse.json(
        { error: "Failed to verify apartment uniqueness" },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate apartment",
          detail:
            "An apartment with this unit number already exists in this building and project.",
        },
        { status: 409 }
      );
    }

    // Insert new apartment record
    const { data, error } = await supabase
      .from("apartments")
      .insert([
        {
          client_name,
          client_surname,
          building_number,
          unit_number: normalizedApartmentNumber,
          apartment_type,
          project_id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error inserting apartment:", error);

      // Handle duplicate key constraint gracefully
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Duplicate apartment",
            detail:
              "An apartment with this unit number already exists in this project.",
          },
          { status: 409 }
        );
      }

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
