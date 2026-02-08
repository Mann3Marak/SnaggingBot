import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, createServiceClient } from "@/lib/server/apiAuth";
import { verifyProjectOwnership } from "@/lib/server/ownershipChecks";

export async function POST(req: NextRequest) {
  try {
    // Authenticate user and get company context
    const { user, profile, supabase } = await requireApiAuth(req);

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

    const companyId = profile.company_id;
    if (!companyId) {
      return NextResponse.json(
        { error: "Your user is not linked to a company. Ask an admin to update your profile." },
        { status: 403 }
      );
    }

    // Verify project belongs to user's company
    const projectOwned = await verifyProjectOwnership(
      supabase,
      project_id,
      companyId
    );

    if (!projectOwned) {
      console.warn("[Apartments] Project access denied", {
        projectId: project_id,
        userId: user.id,
        companyId,
      });
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 403 }
      );
    }

    // Normalize apartment number by removing spaces and trimming
    const normalizedApartmentNumber = apartment_number.replace(/\s+/g, "").trim();

    // Use service role for duplicate check (RLS would filter, causing false negatives)
    const adminClient = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    // Check if apartment already exists in the same project and building
    // Must use service role but ALWAYS filter by the verified project_id
    const { data: existing, error: checkError } = await adminClient
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

    // Insert new apartment record using service role (RLS would block inserts)
    const { data, error } = await adminClient
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
      console.error("[Apartments] Error inserting apartment", {
        error: error.message,
        userId: user.id,
        projectId: project_id,
      });

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

    console.info("[Apartments] Apartment created", {
      apartmentId: data.id,
      projectId: project_id,
      userId: user.id,
      companyId,
    });

    return NextResponse.json({ message: "Apartment created successfully", apartment: data });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    console.error("[Apartments] Unexpected error creating apartment", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Unexpected server error", detail: err.message },
      { status: 500 }
    );
  }
}
