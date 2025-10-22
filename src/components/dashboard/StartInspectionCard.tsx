"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

export default function StartInspectionCard() {
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedApartment, setSelectedApartment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/nhome/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data?.projects) setProjects(data.projects);
      })
      .catch((err) => console.error("Failed to load projects:", err));
  }, []);

  async function handleProjectSelect(projectId: string) {
    setSelectedProject(projects.find((p) => p.id === projectId));
    setSelectedApartment("");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("apartments")
      .select("id, unit_number, apartment_type, building_number")
      .eq("project_id", projectId)
      .order("unit_number", { ascending: true });
    setApartments(data || []);
  }

  async function handleStart() {
    if (!selectedProject || !selectedApartment) return;
    setLoading(true);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Get current user (inspector)
      const { data: user } = await supabase.auth.getUser();
      const inspectorId = user.user?.id;
      if (!inspectorId) throw new Error("Not signed in");
      if (!selectedApartment) throw new Error("Choose an apartment");

      // Check if an active session already exists for this apartment
      const { data: existing } = await supabase
        .from("inspection_sessions")
        .select("*")
        .eq("apartment_id", selectedApartment)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .maybeSingle();

      if (existing) {
        router.push(`/inspection/nhome/${existing.id}`);
        return;
      }

      // Create a new inspection session
      const { data, error } = await supabase
        .from("inspection_sessions")
        .insert({
          apartment_id: selectedApartment,
          inspector_id: inspectorId,
          inspection_type: "initial",
          status: "in_progress",
          nhome_quality_score: null,
          started_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to create inspection session");
      }

      router.push(`/inspection/nhome/${data.id}`);
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

                {selectedProject && (
                  <div className="mt-2 text-sm text-slate-600 border rounded-lg p-2 bg-slate-50">
                    <p><strong>Developer:</strong> {selectedProject.developer_name}</p>
                    <p><strong>Location:</strong> {selectedProject.address}</p>
                    <p><strong>Type:</strong> {selectedProject.type || "N/A"}</p>
                  </div>
                )}
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
