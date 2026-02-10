import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireRole, validateUUID } from "@/lib/server/apiAuth";

type EditableResultRow = {
  id: string;
  status: string;
  notes: string | null;
  enhanced_notes: string | null;
  checklist_templates: {
    room_type: string | null;
    item_description: string | null;
    order_sequence: number | null;
  } | null;
};

type AuditLogRow = {
  id: string;
  batch_id: string;
  field_name: "status" | "enhanced_notes";
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  edited_at: string;
  users: {
    full_name: string | null;
    email: string | null;
  } | { full_name: string | null; email: string | null }[] | null;
  inspection_results: {
    checklist_templates: {
      room_type: string | null;
      item_description: string | null;
    } | { room_type: string | null; item_description: string | null }[] | null;
  } | { checklist_templates: { room_type: string | null; item_description: string | null } | null }[] | null;
};

type UpdatePayload = {
  resultId: string;
  status: "good" | "issue" | "critical" | "skipped" | "not_applicable";
  enhancedNotes: string;
};

const ALLOWED_STATUSES = new Set(["good", "issue", "critical", "skipped", "not_applicable"]);

function normalizeNote(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function ensureString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value;
}

async function verifySessionInCompany(
  supabase: ReturnType<typeof createServiceClient>,
  sessionId: string,
  companyId: string,
) {
  const { data: session, error: sessionError } = await supabase
    .from("inspection_sessions")
    .select(
      `
      id,
      status,
      report_generated_at,
      apartments!inner (
        unit_number,
        apartment_type,
        client_name,
        client_surname,
        projects!inner (
          id,
          name,
          company_id
        )
      )
    `,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: sessionError.message, session: null as any };
  }

  const apartmentJoin = (session as any)?.apartments;
  const apartment = Array.isArray(apartmentJoin) ? apartmentJoin[0] : apartmentJoin;
  const projectJoin = apartment?.projects;
  const project = Array.isArray(projectJoin) ? projectJoin[0] : projectJoin;

  if (!session || !project || project.company_id !== companyId) {
    return { error: "Session not found", session: null as any };
  }

  return {
    error: null,
    session: {
      id: session.id,
      status: session.status,
      report_generated_at: session.report_generated_at,
      apartment: {
        unit_number: apartment?.unit_number ?? null,
        apartment_type: apartment?.apartment_type ?? null,
        client_name: apartment?.client_name ?? null,
        client_surname: apartment?.client_surname ?? null,
      },
      project: {
        id: project.id,
        name: project.name,
      },
    },
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { user, profile } = await requireRole(req, ["admin"]);
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const sessionId = params.sessionId;
    validateUUID(sessionId, "session ID");

    const { error: sessionLookupError, session } = await verifySessionInCompany(
      supabase,
      sessionId,
      profile.company_id!,
    );

    if (sessionLookupError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: results, error: resultsError } = await supabase
      .from("inspection_results")
      .select(
        `
        id,
        status,
        notes,
        enhanced_notes,
        checklist_templates:item_id (
          room_type,
          item_description,
          order_sequence
        )
      `,
      )
      .eq("session_id", sessionId);

    if (resultsError) {
      return NextResponse.json(
        { error: "Failed to load editable report data", detail: resultsError.message },
        { status: 500 },
      );
    }

    const sortedResults = ((results ?? []) as unknown as EditableResultRow[])
      .sort((a, b) => (a.checklist_templates?.order_sequence ?? 9999) - (b.checklist_templates?.order_sequence ?? 9999))
      .map((row) => ({
        id: row.id,
        room: row.checklist_templates?.room_type ?? "Unknown room",
        item: row.checklist_templates?.item_description ?? "Unknown item",
        status: row.status,
        enhancedNotes: row.enhanced_notes ?? "",
        fallbackNotes: row.notes ?? "",
      }));

    const { data: logs, error: logsError } = await supabase
      .from("report_edit_audit_logs")
      .select(
        `
        id,
        batch_id,
        field_name,
        old_value,
        new_value,
        change_reason,
        edited_at,
        users:edited_by (
          full_name,
          email
        ),
        inspection_results:result_id (
          checklist_templates:item_id (
            room_type,
            item_description
          )
        )
      `,
      )
      .eq("session_id", sessionId)
      .order("edited_at", { ascending: false })
      .limit(200);

    if (logsError) {
      return NextResponse.json(
        { error: "Failed to load audit history", detail: logsError.message },
        { status: 500 },
      );
    }

    const auditLogs = ((logs ?? []) as unknown as AuditLogRow[]).map((log) => {
      const userJoin = Array.isArray(log.users) ? log.users[0] : log.users;
      const resultJoin = Array.isArray(log.inspection_results)
        ? log.inspection_results[0]
        : log.inspection_results;
      const templateJoin = Array.isArray(resultJoin?.checklist_templates)
        ? resultJoin?.checklist_templates[0]
        : resultJoin?.checklist_templates;

      return {
        id: log.id,
        batchId: log.batch_id,
        field: log.field_name,
        oldValue: log.old_value,
        newValue: log.new_value,
        reason: log.change_reason,
        editedAt: log.edited_at,
        editedBy: userJoin?.full_name || userJoin?.email || "Unknown admin",
        room: templateJoin?.room_type ?? "Unknown room",
        item: templateJoin?.item_description ?? "Unknown item",
      };
    });

    return NextResponse.json({
      session,
      results: sortedResults,
      auditLogs,
    });
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("[Admin Report Edit] GET unexpected error", { error: error?.message });
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { user, profile } = await requireRole(req, ["admin"]);
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const sessionId = params.sessionId;
    validateUUID(sessionId, "session ID");

    const { error: sessionLookupError, session } = await verifySessionInCompany(
      supabase,
      sessionId,
      profile.company_id!,
    );

    if (sessionLookupError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json();
    const reason = ensureString(body?.reason).trim();
    const updates = Array.isArray(body?.updates) ? (body.updates as UpdatePayload[]) : [];

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "A change reason of at least 5 characters is required." },
        { status: 400 },
      );
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates submitted." }, { status: 400 });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("inspection_results")
      .select("id, session_id, status, enhanced_notes")
      .eq("session_id", sessionId);

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load current report data", detail: existingError.message },
        { status: 500 },
      );
    }

    const existingById = new Map((existingRows ?? []).map((row) => [row.id, row]));
    const batchId = crypto.randomUUID();

    const auditRows: Array<{
      session_id: string;
      result_id: string;
      edited_by: string;
      field_name: "status" | "enhanced_notes";
      old_value: string | null;
      new_value: string | null;
      change_reason: string;
      batch_id: string;
    }> = [];

    for (const update of updates) {
      if (!update?.resultId || typeof update.resultId !== "string") continue;
      validateUUID(update.resultId, "result ID");

      const current = existingById.get(update.resultId);
      if (!current || current.session_id !== sessionId) {
        continue;
      }

      const nextStatus = ensureString(update.status, current.status);
      const nextEnhancedNotes = ensureString(update.enhancedNotes);

      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          { error: `Invalid status supplied for result ${update.resultId}` },
          { status: 400 },
        );
      }

      const patch: Record<string, unknown> = {};

      if (nextStatus !== current.status) {
        patch.status = nextStatus;
        auditRows.push({
          session_id: sessionId,
          result_id: update.resultId,
          edited_by: user.id,
          field_name: "status",
          old_value: current.status,
          new_value: nextStatus,
          change_reason: reason,
          batch_id: batchId,
        });
      }

      if (normalizeNote(nextEnhancedNotes) !== normalizeNote(current.enhanced_notes)) {
        patch.enhanced_notes = nextEnhancedNotes.trim() ? nextEnhancedNotes.trim() : null;
        auditRows.push({
          session_id: sessionId,
          result_id: update.resultId,
          edited_by: user.id,
          field_name: "enhanced_notes",
          old_value: current.enhanced_notes,
          new_value: nextEnhancedNotes.trim() ? nextEnhancedNotes.trim() : null,
          change_reason: reason,
          batch_id: batchId,
        });
      }

      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await supabase
          .from("inspection_results")
          .update(patch)
          .eq("id", update.resultId)
          .eq("session_id", sessionId);

        if (updateError) {
          return NextResponse.json(
            { error: "Failed to save report edits", detail: updateError.message },
            { status: 500 },
          );
        }
      }
    }

    if (auditRows.length === 0) {
      return NextResponse.json({ success: true, message: "No changes detected.", changesCount: 0 });
    }

    const { error: auditInsertError } = await supabase
      .from("report_edit_audit_logs")
      .insert(auditRows);

    if (auditInsertError) {
      return NextResponse.json(
        { error: "Changes saved but failed to write audit log", detail: auditInsertError.message },
        { status: 500 },
      );
    }

    const { error: sessionUpdateError } = await supabase
      .from("inspection_sessions")
      .update({
        report_url_pt: null,
        report_url_en: null,
        report_generated_at: null,
      })
      .eq("id", sessionId);

    if (sessionUpdateError) {
      console.warn("[Admin Report Edit] Could not clear stale report URLs", {
        error: sessionUpdateError.message,
        sessionId,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Report changes saved successfully.",
      changesCount: auditRows.length,
      batchId,
    });
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("[Admin Report Edit] POST unexpected error", { error: error?.message });
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
