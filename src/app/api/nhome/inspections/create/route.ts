import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, createServiceClient } from "@/lib/server/apiAuth";
import { getApartmentCompanyId } from "@/lib/server/ownershipChecks";

/**
 * GET handler for authentication enforcement
 * Returns 405 Method Not Allowed only after authentication check
 * This prevents endpoint enumeration through unauthenticated 405 responses
 */
export async function GET(req: NextRequest) {
  try {
    // Require authentication first (returns 401 if not authenticated)
    await requireApiAuth(req);

    // After authentication, return 405 for wrong method
    return NextResponse.json(
      { error: "Method not allowed. Use POST to create inspections." },
      { status: 405 }
    );
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user and get company context
    const { user, profile, supabase } = await requireApiAuth(req);

    const { project_id, apartment_id } = await req.json();

    if (!project_id || !apartment_id) {
      return NextResponse.json(
        { error: "Missing project_id or apartment_id" },
        { status: 400 }
      );
    }

    // Verify apartment belongs to user's company
    const apartmentCompanyId = await getApartmentCompanyId(supabase, apartment_id);

    if (!apartmentCompanyId || apartmentCompanyId !== profile.company_id) {
      console.warn("[Inspections Create] Apartment access denied", {
        apartmentId: apartment_id,
        userId: user.id,
        userCompany: profile.company_id,
        apartmentCompany: apartmentCompanyId,
      });
      return NextResponse.json(
        { error: "Apartment not found or access denied" },
        { status: 403 }
      );
    }

    // Use service role for insert (RLS might block inserts)
    const adminClient = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const { data, error } = await adminClient
      .from("inspection_sessions")
      .insert([
        {
          apartment_id,
          inspector_id: user.id,  // Set authenticated user as inspector
          status: "in_progress",
          started_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[Inspections Create] Error creating inspection session", {
        error: error.message,
        apartmentId: apartment_id,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Failed to create inspection session", detail: error.message },
        { status: 500 }
      );
    }

    console.info("[Inspections Create] Inspection session created", {
      sessionId: data.id,
      apartmentId: apartment_id,
      userId: user.id,
      companyId: profile.company_id,
    });

    return NextResponse.json({ sessionId: data.id });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    console.error("[Inspections Create] Unexpected error creating inspection session", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Unexpected server error", detail: err.message },
      { status: 500 }
    );
  }
}
