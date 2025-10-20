export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service role key or URL not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch completed sessions that have unresolved items (issue or critical)
    const { data, error } = await supabase
      .from("inspection_sessions")
      .select(`
        id,
        started_at,
        completed_at,
        status,
        inspection_type,
        apartments (
          unit_number,
          apartment_type,
          projects (
            name
          )
        ),
        inspection_results!inner (
          status
        )
      `)
      .eq("status", "completed")
      .or("inspection_results.status.eq.issue,inspection_results.status.eq.critical")
      .order("completed_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load follow-up inspections", detail: error.message },
        { status: 500 }
      );
    }

    // Deduplicate sessions (since join may return multiple rows per session)
    const uniqueSessions = Array.from(
      new Map(
        (data || []).map((s: any) => [s.id, s])
      ).values()
    );

    const formatted = uniqueSessions.map((s: any) => ({
      id: s.id,
      project: s.apartments?.projects?.[0]?.name || s.apartments?.projects?.name || "Unknown Project",
      unit: s.apartments?.unit_number || "Unknown Unit",
      type: s.apartments?.apartment_type || "N/A",
      completed_at: s.completed_at,
      inspection_type: s.inspection_type || "initial",
    }));

    return NextResponse.json({ inspections: formatted });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected server error", detail: e?.message },
      { status: 500 }
    );
  }
}
