import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/server/apiAuth";
import { verifyProjectOwnership } from "@/lib/server/ownershipChecks";

export async function GET(req: NextRequest) {
  try {
    // Authenticate user and get company context
    const { user, profile, supabase } = await requireApiAuth(req);

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
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
      projectId,
      companyId
    );

    if (!projectOwned) {
      console.warn("[Apartments List] Project access denied", {
        projectId,
        userId: user.id,
        companyId,
      });
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 403 }
      );
    }

    // Use authenticated client (respects RLS) to list apartments
    const { data, error } = await supabase
      .from("apartments")
      .select("id, unit_number, apartment_type, building_number")
      .eq("project_id", projectId)
      .order("unit_number", { ascending: true });

    if (error) {
      console.error("[Apartments List] Error fetching apartments", {
        error: error.message,
        projectId,
        userId: user.id,
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.info("[Apartments List] Apartments fetched", {
      projectId,
      count: data?.length || 0,
      userId: user.id,
      companyId,
    });

    return NextResponse.json({ apartments: data || [] }, { status: 200 });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    console.error("[Apartments List] Unexpected error fetching apartments", {
      error: err.message,
    });
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
