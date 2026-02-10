"use client";
import { useEffect, useMemo, useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "@/hooks/useAuthUser";

type Project = {
  id: string;
  name: string;
};

type InspectionOption = {
  id: string;
  clientName: string;
  apartmentDetails: string;
};

type EditableItem = {
  id: string;
  room: string;
  item: string;
  status: "good" | "issue" | "critical" | "skipped" | "not_applicable";
  enhancedNotes: string;
  fallbackNotes: string;
};

type AuditLog = {
  id: string;
  batchId: string;
  field: "status" | "enhanced_notes";
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  editedAt: string;
  editedBy: string;
  room: string;
  item: string;
};

const STATUS_OPTIONS: Array<EditableItem["status"]> = [
  "good",
  "issue",
  "critical",
  "skipped",
  "not_applicable",
];

function toDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function EditReportCard() {
  const { user } = useAuthUser();
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inspections, setInspections] = useState<InspectionOption[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState("");
  const [sessionSummary, setSessionSummary] = useState<{
    projectName?: string | null;
    unitNumber?: string | null;
    apartmentType?: string | null;
    clientName?: string | null;
  } | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [originalItems, setOriginalItems] = useState<EditableItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [changeReason, setChangeReason] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [loadingReportData, setLoadingReportData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const canInteract = useMemo(
    () => !loadingProjects && !loadingInspections && !loadingReportData && !saving,
    [loadingProjects, loadingInspections, loadingReportData, saving],
  );

  const dirtyCount = useMemo(() => {
    if (items.length === 0 || originalItems.length === 0) return 0;
    const originalById = new Map(originalItems.map((item) => [item.id, item]));
    return items.reduce((count, current) => {
      const original = originalById.get(current.id);
      if (!original) return count;
      const statusChanged = original.status !== current.status;
      const noteChanged = (original.enhancedNotes || "").trim() !== (current.enhancedNotes || "").trim();
      return statusChanged || noteChanged ? count + 1 : count;
    }, 0);
  }, [items, originalItems]);

  useEffect(() => {
    if (!showModal) return;

    let ignore = false;
    async function loadProjects() {
      setLoadingProjects(true);
      setErrorMessage("");
      setInfoMessage("");
      try {
        const res = await fetch("/api/nhome/projects", { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load projects");
        if (!ignore) setProjects(json.projects || []);
      } catch (err: any) {
        if (!ignore) {
          setProjects([]);
          setErrorMessage(err?.message || "Failed to load projects");
        }
      } finally {
        if (!ignore) setLoadingProjects(false);
      }
    }

    loadProjects();
    return () => {
      ignore = true;
    };
  }, [showModal]);

  async function loadInspections(projectId: string) {
    setLoadingInspections(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const res = await fetch(`/api/admin/inspections?projectId=${encodeURIComponent(projectId)}&status=completed`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load inspections");
      setInspections(json.inspections || []);
    } catch (err: any) {
      setInspections([]);
      setErrorMessage(err?.message || "Failed to load inspections");
    } finally {
      setLoadingInspections(false);
    }
  }

  async function loadReportData(sessionId: string) {
    setLoadingReportData(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const res = await fetch(`/api/admin/reports/${encodeURIComponent(sessionId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load report data");

      const editableItems = (json.results || []) as EditableItem[];
      setItems(editableItems);
      setOriginalItems(editableItems.map((item) => ({ ...item })));
      setAuditLogs((json.auditLogs || []) as AuditLog[]);

      const session = json.session;
      setSessionSummary({
        projectName: session?.project?.name ?? null,
        unitNumber: session?.apartment?.unit_number ?? null,
        apartmentType: session?.apartment?.apartment_type ?? null,
        clientName: `${session?.apartment?.client_name ?? ""} ${session?.apartment?.client_surname ?? ""}`.trim() || null,
      });
    } catch (err: any) {
      setItems([]);
      setOriginalItems([]);
      setAuditLogs([]);
      setSessionSummary(null);
      setErrorMessage(err?.message || "Failed to load report data");
    } finally {
      setLoadingReportData(false);
    }
  }

  const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    setSelectedProject(projectId);
    setSelectedInspectionId("");
    setInspections([]);
    setItems([]);
    setOriginalItems([]);
    setAuditLogs([]);
    setSessionSummary(null);
    setChangeReason("");
    if (!projectId) return;
    await loadInspections(projectId);
  };

  const handleInspectionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sessionId = e.target.value;
    setSelectedInspectionId(sessionId);
    setItems([]);
    setOriginalItems([]);
    setAuditLogs([]);
    setSessionSummary(null);
    setChangeReason("");
    if (!sessionId) return;
    await loadReportData(sessionId);
  };

  const handleItemChange = (
    id: string,
    patch: Partial<Pick<EditableItem, "status" | "enhancedNotes">>,
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleSave = async () => {
    setErrorMessage("");
    setInfoMessage("");

    if (!selectedInspectionId) {
      setErrorMessage("Select an inspection first.");
      return;
    }
    if (dirtyCount === 0) {
      setInfoMessage("No changes to save.");
      return;
    }
    if (!changeReason.trim() || changeReason.trim().length < 5) {
      setErrorMessage("Provide a change reason (at least 5 characters) before saving.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        reason: changeReason.trim(),
        updates: items.map((item) => ({
          resultId: item.id,
          status: item.status,
          enhancedNotes: item.enhancedNotes,
        })),
      };

      const res = await fetch(`/api/admin/reports/${encodeURIComponent(selectedInspectionId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save report changes");

      setInfoMessage(`Saved ${json.changesCount ?? 0} audited changes.`);
      setChangeReason("");
      await loadReportData(selectedInspectionId);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save report changes");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setProjects([]);
    setInspections([]);
    setSelectedProject("");
    setSelectedInspectionId("");
    setItems([]);
    setOriginalItems([]);
    setAuditLogs([]);
    setSessionSummary(null);
    setChangeReason("");
    setLoadingProjects(false);
    setLoadingInspections(false);
    setLoadingReportData(false);
    setSaving(false);
    setErrorMessage("");
    setInfoMessage("");
  };

  // Only admins can see this card
  if (!user || user.role !== "admin") return null;

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <PencilSquareIcon className="h-6 w-6 text-nhome-primary" />
          <h3 className="font-semibold text-nhome-primary">Edit Report</h3>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Modify report findings with explicit save and audit tracking
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-6xl shadow-lg max-h-[92vh] overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Edit Report
            </h2>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Project
                  </label>
                  <select
                    value={selectedProject}
                    onChange={handleProjectChange}
                    disabled={!canInteract}
                    className="border border-slate-300 rounded-lg p-2 w-full focus:ring-2 focus:ring-nhome-primary focus:border-nhome-primary disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingProjects ? "Loading projects..." : "Select a project..."}
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Inspection
                  </label>
                  <select
                    value={selectedInspectionId}
                    onChange={handleInspectionChange}
                    disabled={!selectedProject || !canInteract}
                    className="border border-slate-300 rounded-lg p-2 w-full focus:ring-2 focus:ring-nhome-primary focus:border-nhome-primary disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingInspections ? "Loading inspections..." : "Select an inspection..."}
                    </option>
                    {inspections.map((inspection) => (
                      <option key={inspection.id} value={inspection.id}>
                        {inspection.clientName} - {inspection.apartmentDetails}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {sessionSummary && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p>
                    <span className="font-medium">Project:</span> {sessionSummary.projectName || "Unknown"}
                  </p>
                  <p>
                    <span className="font-medium">Unit:</span> {sessionSummary.unitNumber || "Unknown"}{" "}
                    {sessionSummary.apartmentType ? `(${sessionSummary.apartmentType})` : ""}
                  </p>
                  <p>
                    <span className="font-medium">Client:</span> {sessionSummary.clientName || "No Client Assigned"}
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {infoMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {infoMessage}
                </div>
              )}

              {selectedInspectionId && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
                    Editable Findings ({items.length})
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {loadingReportData ? (
                      <div className="p-4 text-sm text-slate-500">Loading report fields...</div>
                    ) : items.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No editable findings found for this inspection.</div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-white sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Room / Item</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Status</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Report Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 align-top text-sm">
                                <p className="font-medium text-slate-800">{item.room}</p>
                                <p className="text-slate-600">{item.item}</p>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <select
                                  value={item.status}
                                  disabled={!canInteract}
                                  onChange={(e) =>
                                    handleItemChange(item.id, {
                                      status: e.target.value as EditableItem["status"],
                                    })
                                  }
                                  className="border border-slate-300 rounded-lg p-2 w-full text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 align-top">
                                <textarea
                                  value={item.enhancedNotes}
                                  disabled={!canInteract}
                                  onChange={(e) =>
                                    handleItemChange(item.id, { enhancedNotes: e.target.value })
                                  }
                                  placeholder={item.fallbackNotes || "Add report note..."}
                                  className="border border-slate-300 rounded-lg p-2 w-full text-sm min-h-[88px] resize-y disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {selectedInspectionId && (
                <div className="rounded-lg border border-slate-200 p-4 bg-white">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Change Reason (required for audit)
                  </label>
                  <textarea
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    disabled={!canInteract}
                    placeholder="Explain why these report changes are needed..."
                    className="border border-slate-300 rounded-lg p-2 w-full min-h-[84px] text-sm resize-y disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Edits are only saved when you click Save Changes. No autosave.
                  </p>
                </div>
              )}

              {selectedInspectionId && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
                    Audit History ({auditLogs.length})
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {auditLogs.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No audit entries yet.</div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-white sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">When</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Admin</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Field</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Item</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="px-4 py-2 text-xs text-slate-600">{toDateTime(log.editedAt)}</td>
                              <td className="px-4 py-2 text-xs text-slate-700">{log.editedBy}</td>
                              <td className="px-4 py-2 text-xs text-slate-700">{log.field}</td>
                              <td className="px-4 py-2 text-xs text-slate-700">
                                {log.room} - {log.item}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-700">
                                <p>
                                  <span className="font-medium">From:</span> {log.oldValue || "(empty)"}
                                </p>
                                <p>
                                  <span className="font-medium">To:</span> {log.newValue || "(empty)"}
                                </p>
                                {log.reason ? (
                                  <p className="text-slate-500 mt-1">
                                    <span className="font-medium">Reason:</span> {log.reason}
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!selectedInspectionId || !canInteract || dirtyCount === 0}
                  className="flex-1 bg-nhome-primary text-white py-2 rounded-lg hover:bg-nhome-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : `Save Changes${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
                </button>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="mt-4 w-full text-sm text-slate-500 hover:text-nhome-primary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
