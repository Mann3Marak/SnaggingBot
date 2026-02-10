"use client";
import { useEffect, useMemo, useState } from "react";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "@/hooks/useAuthUser";

interface Project {
  id: string;
  name: string;
}

interface InspectionWithReports {
  id: string;
  clientName: string;
  apartmentDetails: string;
  reports?: {
    english?: string | null;
    portuguese?: string | null;
  };
}

export default function ReprintReportCard() {
  const { user } = useAuthUser();
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [inspections, setInspections] = useState<InspectionWithReports[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState("");
  const [language, setLanguage] = useState<"english" | "portuguese">("english");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [openingReport, setOpeningReport] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const canInteract = useMemo(
    () => !loadingProjects && !loadingInspections && !openingReport,
    [loadingProjects, loadingInspections, openingReport],
  );

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

  async function loadProjectInspections(projectId: string) {
    setLoadingInspections(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const res = await fetch(
        `/api/admin/inspections?projectId=${encodeURIComponent(projectId)}&status=completed&includeReports=1`,
        { credentials: "include" },
      );
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

  const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    setSelectedProject(projectId);
    setSelectedInspectionId("");
    setInspections([]);

    if (!projectId) return;
    await loadProjectInspections(projectId);
  };

  const handleOpenReport = async () => {
    setErrorMessage("");
    setInfoMessage("");

    if (!selectedInspectionId) {
      setErrorMessage("Select an inspection first.");
      return;
    }

    const selectedInspection = inspections.find((i) => i.id === selectedInspectionId);
    if (!selectedInspection) {
      setErrorMessage("Selected inspection could not be found.");
      return;
    }

    const reportUrl =
      language === "english"
        ? selectedInspection.reports?.english
        : selectedInspection.reports?.portuguese;

    if (!reportUrl) {
      setInfoMessage(
        language === "english"
          ? "No saved English report was found for this inspection."
          : "No saved Portuguese report was found for this inspection.",
      );
      return;
    }

    setOpeningReport(true);
    try {
      window.open(reportUrl, "_blank", "noopener,noreferrer");
      setInfoMessage("Opened the existing report in a new tab.");
    } finally {
      setOpeningReport(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setProjects([]);
    setSelectedProject("");
    setInspections([]);
    setSelectedInspectionId("");
    setLanguage("english");
    setLoadingProjects(false);
    setLoadingInspections(false);
    setOpeningReport(false);
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
          <PrinterIcon className="h-6 w-6 text-nhome-primary" />
          <h3 className="font-semibold text-nhome-primary">Reprint Report</h3>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Open a previously generated report for an inspection
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Reprint Report
            </h2>

            <div className="space-y-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Select Project
                </label>
                <select
                  value={selectedProject}
                  onChange={handleProjectChange}
                  disabled={!canInteract}
                  className="border border-slate-300 rounded-lg p-2 w-full focus:ring-2 focus:ring-nhome-primary focus:border-nhome-primary disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-medium text-slate-700">
                  Select Inspection
                </label>
                <select
                  value={selectedInspectionId}
                  onChange={(e) => setSelectedInspectionId(e.target.value)}
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

                <label className="block text-sm font-medium text-slate-700">
                  Report Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as "english" | "portuguese")}
                  disabled={!canInteract}
                  className="border border-slate-300 rounded-lg p-2 w-full focus:ring-2 focus:ring-nhome-primary focus:border-nhome-primary disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="english">English</option>
                  <option value="portuguese">Portuguese</option>
                </select>
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {infoMessage && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {infoMessage}
                </div>
              )}

              <button
                onClick={handleOpenReport}
                disabled={!selectedInspectionId || !canInteract}
                className="w-full bg-nhome-primary text-white py-2 rounded-lg hover:bg-nhome-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {openingReport ? "Opening..." : "Open Existing Report"}
              </button>
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
