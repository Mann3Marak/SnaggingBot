import { NextRequest, NextResponse } from "next/server";
import { requireOwnership, createServiceClient } from "@/lib/server/apiAuth";

/**
 * Diagnostic endpoint to inspect all data linked to a given sessionId.
 * Lists session, results, and photos to verify data integrity.
 * Only accessible to the inspector who owns the session or an admin.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;

  try {
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Verify user owns the session or is admin
    const { user, profile } = await requireOwnership(req, {
      type: "session",
      resourceId: sessionId,
    });

    const isAdmin = profile.role === "admin";

    console.info("[Diagnostics] Generating diagnostic snapshot", {
      sessionId,
      userId: user.id,
      isAdmin,
    });

    // Use service role for comprehensive diagnostic query
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const { data: session, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    const { data: results, error: resultsError } = await supabase
      .from("inspection_results")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const { data: photos, error: photosError } = await supabase
      .from("nhome_photos")
      .select("*")
      .eq("session_id", sessionId);

    const { data: allSessions, error: allSessionsError } = await supabase
      .from("inspection_sessions")
      .select("id, apartment_id, current_item_index, status")
      .eq("inspector_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50);

    console.info("[Diagnostics] Snapshot generated", {
      sessionId,
      userId: user.id,
      resultsCount: results?.length ?? 0,
      photosCount: photos?.length ?? 0,
    });

    return NextResponse.json({
      sessionError,
      resultsError,
      photosError,
      allSessionsError,
      session,
      resultsCount: results?.length ?? 0,
      photosCount: photos?.length ?? 0,
      results,
      photos,
      allSessionsCount: allSessions?.length ?? 0,
      allSessions,
      note: allSessionsError
        ? "Inspection sessions fetched without ordering fields."
        : "All data fetched successfully.",
    });
  } catch (e: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (e instanceof NextResponse) {
      return e;
    }

    console.error("[Diagnostics] Unexpected error", {
      error: e?.message,
      sessionId,
    });
    return NextResponse.json(
      { error: "Unexpected diagnostic error", detail: e?.message },
      { status: 500 }
    );
  }
}
