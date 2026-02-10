import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/server/apiAuth";
import { verifyProjectOwnership } from "@/lib/server/ownershipChecks";

export async function GET(req: NextRequest) {
  try {
    // Authenticate user and get company context
    const { user, profile, supabase } = await requireApiAuth(req);

    const projectId = req.nextUrl.searchParams.get("projectId");
    const mode = req.nextUrl.searchParams.get("mode") === "follow_up" ? "follow_up" : "initial";
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

    const apartments = data || [];

    // Exclude apartments based on inspection flow mode.
    const apartmentIds = apartments.map((a) => a.id);
    const availableApartmentIds = new Set<string>(apartmentIds);

    if (apartmentIds.length > 0) {
      const { data: sessions, error: sessionsError } = await supabase
        .from("inspection_sessions")
        .select("apartment_id, status")
        .in("apartment_id", apartmentIds);

      if (sessionsError) {
        console.error("[Apartments List] Error checking inspection sessions", {
          error: sessionsError.message,
          projectId,
          userId: user.id,
        });
        return NextResponse.json(
          { error: "Failed to determine apartment availability" },
          { status: 500 }
        );
      }

      const sessionsByApartment = new Map<string, string[]>();
      for (const session of sessions || []) {
        if (!session.apartment_id) continue;
        const bucket = sessionsByApartment.get(session.apartment_id) ?? [];
        bucket.push(session.status);
        sessionsByApartment.set(session.apartment_id, bucket);
      }

      for (const apartmentId of apartmentIds) {
        const statuses = sessionsByApartment.get(apartmentId) ?? [];
        const hasInProgress = statuses.includes("in_progress");
        const hasCompleted = statuses.includes("completed");

        if (mode === "initial") {
          // Once an apartment has started/completed an inspection, it should
          // no longer appear in the "start initial inspection" picker.
          if (hasInProgress || hasCompleted) {
            availableApartmentIds.delete(apartmentId);
          }
          continue;
        }

        // follow_up mode:
        // - requires at least one completed inspection
        // - cannot have an active in-progress inspection
        if (hasInProgress || !hasCompleted) {
          availableApartmentIds.delete(apartmentId);
        }
      }
    }

    const availableApartments = apartments.filter(
      (apartment) => availableApartmentIds.has(apartment.id)
    );

    console.info("[Apartments List] Apartments fetched", {
      projectId,
      mode,
      count: availableApartments.length,
      blockedCount: apartments.length - availableApartments.length,
      userId: user.id,
      companyId,
    });

    return NextResponse.json({ apartments: availableApartments }, { status: 200 });
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
