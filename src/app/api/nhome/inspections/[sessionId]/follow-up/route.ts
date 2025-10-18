export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        { error: "Supabase service role key or URL not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Fetch session with apartment and project details
    const { data: session, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select(`
        id,
        status,
        started_at,
        completed_at,
        apartments (
          unit_number,
          apartment_type,
          projects ( name )
        )
      `)
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found or not accessible", detail: sessionError?.message },
        { status: 404 }
      );
    }

    // 2) Fetch only items with issues or critical status
    const { data: results, error: resultsError } = await supabase
      .from("inspection_results")
      .select("*, checklist_templates:item_id(*)")
      .eq("session_id", sessionId)
      .in("status", ["issue", "critical"])
      .order("created_at", { ascending: true });

    if (resultsError) {
      return NextResponse.json(
        { error: "Failed to load follow-up items", detail: resultsError.message },
        { status: 500 }
      );
    }

    // 3) Shape the response
    const followUpItems = (results ?? []).map((r) => ({
      id: r.id,
      item_id: r.item_id,
      description: r.checklist_templates?.item_description || "Unknown Item",
      status: r.status,
      notes: r.notes,
      fixed: false,
      follow_up_comment: "",
    }));

    const apartment = Array.isArray(session.apartments)
      ? session.apartments[0]
      : session.apartments;

    const unit_number = apartment?.unit_number || null;
    const apartment_type = apartment?.apartment_type || null;
    let project_name: string | null = null;
    if (apartment?.projects) {
      if (Array.isArray(apartment.projects)) {
        project_name = apartment.projects[0]?.name || null;
      } else if (typeof apartment.projects === "object" && "name" in apartment.projects) {
        project_name = (apartment.projects as { name?: string }).name || null;
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        unit_number,
        apartment_type,
        project_name,
      },
      followUpItems,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected server error", detail: e?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, updates } = body;

    if (!sessionId || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service role key or URL not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Update each item with follow-up data
    const updatesWithTimestamps = updates.map((u) => ({
      id: u.id,
      follow_up_fixed: u.fixed,
      follow_up_comment: u.comment || null,
      follow_up_updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("inspection_results")
      .update(
        updates.map((u) => ({
          follow_up_fixed: u.fixed,
          follow_up_comment: u.comment || null,
          follow_up_updated_at: new Date().toISOString(),
        }))
      )
      .in("id", updates.map((u) => u.id))
      .select("*");

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: "Failed to update follow-up results", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updated: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected server error", detail: e?.message },
      { status: 500 }
    );
  }
}
