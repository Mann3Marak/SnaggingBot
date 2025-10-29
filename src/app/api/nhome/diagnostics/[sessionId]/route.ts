import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

/**
 * Diagnostic endpoint to inspect all data linked to a given sessionId.
 * Lists session, results, and photos to verify data integrity.
 * Only accessible to the inspector who owns the session or an admin.
 */
export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase credentials missing" },
        { status: 500 }
      );
    }

    const cookieStore = cookies();
    const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError) {
      console.error("[NHomeDiagnostics] Unable to read auth user", userError);
      return NextResponse.json({ error: "Unable to read user session" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[NHomeDiagnostics] Failed to resolve user profile", profileError);
      return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 500 });
    }

    const { data: ownershipCheck, error: ownershipError } = await adminClient
      .from("inspection_sessions")
      .select("inspector_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (ownershipError) {
      console.error("[NHomeDiagnostics] Ownership check failed", ownershipError);
      return NextResponse.json({ error: "Inspection session lookup failed" }, { status: 500 });
    }

    if (!ownershipCheck) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner = ownershipCheck.inspector_id === user.id;
    const isAdmin = profile?.role === "admin";

    if (!isOwner && !isAdmin) {
      console.warn("[NHomeDiagnostics] Access denied", {
        sessionId,
        requester: user.id,
        inspector: ownershipCheck.inspector_id,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.info("[NHomeDiagnostics] Generating snapshot", {
      sessionId,
      requester: user.id,
      isOwner,
      isAdmin,
    });

    const { data: session, error: sessionError } = await adminClient
      .from("inspection_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    const { data: results, error: resultsError } = await adminClient
      .from("inspection_results")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const { data: photos, error: photosError } = await adminClient
      .from("nhome_photos")
      .select("*")
      .eq("session_id", sessionId);

    const { data: allSessions, error: allSessionsError } = await adminClient
      .from("inspection_sessions")
      .select("id, apartment_id, current_item_index, status")
      .eq("inspector_id", user.id)
      .order("started_at", { ascending: false })
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
        ? "Inspection sessions fetched without ordering fields."
        : "All data fetched successfully.",
    });
  } catch (e: any) {
    console.error("[NHomeDiagnostics] Unexpected error", e);
    return NextResponse.json(
      { error: "Unexpected diagnostic error", detail: e?.message },
      { status: 500 }
    );
  }
}
