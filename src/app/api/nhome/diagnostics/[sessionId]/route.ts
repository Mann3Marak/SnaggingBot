import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Diagnostic endpoint to inspect all data linked to a given sessionId.
 * Lists session, results, and photos to verify data integrity.
 */
export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  try {
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase credentials missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    // Fetch results
    const { data: results, error: resultsError } = await supabase
      .from("inspection_results")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    // Fetch photos (fallback if created_at column doesn't exist)
    const { data: photos, error: photosError } = await supabase
      .from("nhome_inspection_photos")
      .select("*")
      .eq("session_id", sessionId);

    // Fetch all sessions for overview (fallback if created_at column doesn't exist)
    const { data: allSessions, error: allSessionsError } = await supabase
      .from("inspection_sessions")
      .select("id, apartment_id, current_item_index, status")
      .limit(50);

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
        ? "⚠️ The inspection_sessions table does not have created_at/updated_at columns. Data was still fetched without ordering."
        : "✅ All data fetched successfully.",
    });
  } catch (e: any) {
    console.error("❌ Diagnostic error:", e);
    return NextResponse.json(
      { error: "Unexpected diagnostic error", detail: e?.message },
      { status: 500 }
    );
  }
}
