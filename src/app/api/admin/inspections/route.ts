import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireRole, validateUUID } from "@/lib/server/apiAuth";

const PHOTO_BUCKET = "nhome_photos";
const REPORT_BUCKET = "nhome_reports";

type InspectionListRow = {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  report_url_pt: string | null;
  report_url_en: string | null;
  report_generated_at: string | null;
  apartments: {
    unit_number: string | null;
    apartment_type: string | null;
    client_name: string | null;
    client_surname: string | null;
    projects: {
      name: string | null;
      company_id: string | null;
    } | null;
  } | null;
};

function mapStatus(status: string): "in_progress" | "completed" | "cancelled" {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "in_progress";
}

function buildClientName(clientName?: string | null, clientSurname?: string | null): string {
  const fullName = `${clientName ?? ""} ${clientSurname ?? ""}`.trim();
  return fullName || "No Client Assigned";
}

function normalizeStoragePath(path: string): string {
  return path.split("?")[0];
}

function resolveReportPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripQuery = (input: string) => input.split("?")[0];

  if (value.startsWith("reports/")) return stripQuery(value);

  const marker = "/nhome_reports/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    return stripQuery(value.slice(markerIndex + marker.length));
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { user, profile } = await requireRole(req, ["admin"]);
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const projectId = req.nextUrl.searchParams.get("projectId");
    const statusFilter = req.nextUrl.searchParams.get("status");
    const includeReports = req.nextUrl.searchParams.get("includeReports") === "1";
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }
    validateUUID(projectId, "project ID");

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, company_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("[Admin Inspections] Failed to load project", {
        error: projectError.message,
        projectId,
        userId: user.id,
      });
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }

    if (!project || project.company_id !== profile.company_id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("inspection_sessions")
      .select(
        `
        id,
        status,
        started_at,
        completed_at,
        report_url_pt,
        report_url_en,
        report_generated_at,
        apartments!inner (
          project_id,
          unit_number,
          apartment_type,
          client_name,
          client_surname,
          projects!inner (
            name,
            company_id
          )
        )
      `,
      )
      .eq("apartments.project_id", projectId)
      .eq("apartments.projects.company_id", profile.company_id)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("[Admin Inspections] Failed to load inspections", {
        error: error.message,
        userId: user.id,
        projectId,
      });
      return NextResponse.json({ error: "Failed to load inspections" }, { status: 500 });
    }

    let sessions = (data ?? []) as unknown as InspectionListRow[];
    if (statusFilter === "completed") {
      sessions = sessions.filter((session) => session.status === "completed");
    }

    const inspections = await Promise.all(
      sessions.map(async (session) => {
        let portugueseReport: string | null = null;
        let englishReport: string | null = null;

        if (includeReports) {
          const ptPath = resolveReportPath(session.report_url_pt);
          const enPath = resolveReportPath(session.report_url_en);

          if (ptPath) {
            const { data: signed } = await supabase.storage
              .from(REPORT_BUCKET)
              .createSignedUrl(ptPath, 60 * 60 * 24 * 7);
            portugueseReport = signed?.signedUrl ?? null;
          }

          if (enPath) {
            const { data: signed } = await supabase.storage
              .from(REPORT_BUCKET)
              .createSignedUrl(enPath, 60 * 60 * 24 * 7);
            englishReport = signed?.signedUrl ?? null;
          }
        }

        return {
          id: session.id,
          clientName: buildClientName(session.apartments?.client_name, session.apartments?.client_surname),
          apartmentDetails: `${session.apartments?.projects?.name ?? "Unknown Project"}, ${session.apartments?.unit_number ?? "Unknown Unit"}${session.apartments?.apartment_type ? ` (${session.apartments.apartment_type})` : ""}`,
          status: mapStatus(session.status),
          startedAt: session.started_at,
          completedAt: session.completed_at,
          reportGeneratedAt: session.report_generated_at,
          reports: {
            portuguese: portugueseReport,
            english: englishReport,
          },
        };
      }),
    );

    return NextResponse.json({ inspections });
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("[Admin Inspections] Unexpected GET error", {
      error: error?.message,
    });
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, profile } = await requireRole(req, ["admin"]);
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const body = await req.json();
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    validateUUID(sessionId, "session ID");

    const { data: session, error: sessionError } = await supabase
      .from("inspection_sessions")
      .select(
        `
        id,
        apartments!inner (
          project_id,
          projects!inner (
            company_id
          )
        )
      `,
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("[Admin Inspections] Failed to load session", {
        error: sessionError.message,
        sessionId,
        userId: user.id,
      });
      return NextResponse.json({ error: "Failed to load inspection" }, { status: 500 });
    }

    const apartmentJoin = (session as any)?.apartments;
    const apartment = Array.isArray(apartmentJoin) ? apartmentJoin[0] : apartmentJoin;
    const projectJoin = apartment?.projects;
    const project = Array.isArray(projectJoin) ? projectJoin[0] : projectJoin;
    const sessionCompanyId = project?.company_id;
    if (!session || sessionCompanyId !== profile.company_id) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const { data: photos, error: photosError } = await supabase
      .from("nhome_photos")
      .select("file_name, storage_path")
      .eq("session_id", sessionId);

    if (photosError) {
      console.warn("[Admin Inspections] Failed to load photo metadata before deletion", {
        error: photosError.message,
        sessionId,
      });
    }

    const pathsToRemove = new Set<string>();
    for (const photo of photos ?? []) {
      const fileName = photo.file_name ?? "";
      const storagePath = photo.storage_path ? normalizeStoragePath(photo.storage_path) : null;

      if (storagePath) {
        pathsToRemove.add(storagePath);
      }

      if (fileName) {
        pathsToRemove.add(`sessions/${sessionId}/${fileName}`);
      }
    }

    if (pathsToRemove.size > 0) {
      const { error: removeError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove(Array.from(pathsToRemove));

      if (removeError) {
        console.warn("[Admin Inspections] Storage cleanup warning", {
          error: removeError.message,
          sessionId,
          attemptedPaths: pathsToRemove.size,
        });
      }
    }

    const { error: deleteError } = await supabase
      .from("inspection_sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteError) {
      console.error("[Admin Inspections] Failed to delete inspection", {
        error: deleteError.message,
        sessionId,
        userId: user.id,
      });
      return NextResponse.json({ error: "Failed to delete inspection" }, { status: 500 });
    }

    console.info("[Admin Inspections] Inspection deleted", {
      sessionId,
      userId: user.id,
      companyId: profile.company_id,
      removedStoragePaths: pathsToRemove.size,
    });

    return NextResponse.json({ success: true, sessionId });
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("[Admin Inspections] Unexpected DELETE error", {
      error: error?.message,
    });
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
