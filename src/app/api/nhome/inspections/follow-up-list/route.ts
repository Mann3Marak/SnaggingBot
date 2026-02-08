import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, createServiceClient } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // Authenticate user and get company context
    const { user, profile } = await requireApiAuth(req);

    console.info("[Follow-up List] Loading follow-up inspections", {
      userId: user.id,
      companyId: profile.company_id,
    });

    // Use service role for comprehensive query (bypasses RLS)
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    // Fetch completed sessions in user's company
    // CRITICAL: Filter by company_id through projects join to enforce company isolation
    const { data: sessions, error } = await supabase
      .from("inspection_sessions")
      .select(`
        id,
        started_at,
        completed_at,
        status,
        inspection_type,
        apartments!inner (
          unit_number,
          apartment_type,
          projects!inner (
            name,
            company_id
          )
        )
      `)
      .eq("status", "completed")
      .eq("apartments.projects.company_id", profile.company_id)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("[Follow-up List] Failed to load follow-up inspections", {
        error: error.message,
        userId: user.id,
        companyId: profile.company_id,
      });
      return NextResponse.json(
        { error: "Failed to load follow-up inspections", detail: error.message },
        { status: 500 }
      );
    }

    // Format sessions for response
    const formatted = (sessions || []).map((s: any) => ({
      id: s.id,
      project: s.apartments?.projects?.[0]?.name || s.apartments?.projects?.name || "Unknown Project",
      unit: s.apartments?.unit_number || "Unknown Unit",
      type: s.apartments?.apartment_type || "N/A",
      completed_at: s.completed_at,
      inspection_type: s.inspection_type || "initial",
    }));

    console.info("[Follow-up List] Follow-up inspections loaded", {
      count: formatted.length,
      userId: user.id,
      companyId: profile.company_id,
    });

    return NextResponse.json({ inspections: formatted });
  } catch (e: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (e instanceof NextResponse) {
      return e;
    }

    console.error("[Follow-up List] Unexpected error", {
      error: e?.message,
    });
    return NextResponse.json(
      { error: "Unexpected server error", detail: e?.message },
      { status: 500 }
    );
  }
}
