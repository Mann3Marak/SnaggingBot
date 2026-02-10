"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function StartInspectionCard() {
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedApartment, setSelectedApartment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Fetch projects each time the modal is opened to ensure fresh data
  useEffect(() => {
    if (!showModal) return;

    let active = true;
    const loadProjects = async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        const res = await fetch("/api/nhome/projects/list", {
          cache: "no-store",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(detail || `Request failed (${res.status})`);
        }

        const payload = await res.json();
        if (active) {
          setProjects(payload?.projects ?? []);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
        if (active) setProjects([]);
      }
    };

    loadProjects();
    return () => {
      active = false;
    };
  }, [showModal]);

  async function handleProjectSelect(projectId: string) {
    setSelectedProject(projects.find((p) => p.id === projectId));
    setSelectedApartment("");
    try {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`/api/nhome/apartments/list?projectId=${projectId}&mode=initial`, {
        cache: "no-store",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (data?.apartments) {
        setApartments(data.apartments);
      } else {
        setApartments([]);
      }
    } catch (err) {
      console.error("Error fetching apartments:", err);
      setApartments([]);
    }
  }

  async function handleStart() {
    if (!selectedProject || !selectedApartment) return;
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/nhome/inspections/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          project_id: selectedProject?.id,
          apartment_id: selectedApartment,
          inspection_type: "initial",
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (res.status === 409 && payload?.existingSessionId) {
        router.push(`/inspection/nhome/${payload.existingSessionId}`);
        return;
      }

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create inspection session");
      }

      if (!payload?.sessionId) {
        throw new Error("Inspection session created but no session ID was returned");
      }

      router.push(`/inspection/nhome/${payload.sessionId}`);
    } catch (err) {
      console.error("Error starting inspection:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Error starting inspection: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
      >
        <h3 className="font-semibold text-nhome-primary">Start New Inspection</h3>
        <p className="text-sm text-slate-600 mt-1">
          Launch a guided inspection workflow
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Start New Inspection
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Development Project
                </label>
                <select
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="border rounded-lg p-2 w-full"
                  defaultValue=""
                >
                  <option value="">Choose a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Removed project details section for cleaner UI */}
              </div>

              {selectedProject && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Apartment Unit
                  </label>
                  <select
                    value={selectedApartment}
                    onChange={(e) => setSelectedApartment(e.target.value)}
                    className="border rounded-lg p-2 w-full"
                  >
                    <option value="">Choose an apartment...</option>
                    {apartments.map((a) => (
                      <option key={a.id} value={a.id}>
                        Unit {a.unit_number} - {a.apartment_type} (Building {a.building_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleStart}
                disabled={!selectedProject || !selectedApartment || loading}
                className="w-full bg-nhome-primary text-white py-2 rounded-lg hover:bg-nhome-secondary transition disabled:opacity-50"
              >
                {loading ? "Starting..." : "Start Inspection"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="w-full text-sm text-slate-500 hover:text-nhome-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
