"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AddApartmentCard() {
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableLotes, setAvailableLotes] = useState<string[]>([]);
  const [form, setForm] = useState({
    client_name: "",
    client_surname: "",
    building_number: "",
    apartment_number: "",
    apartment_type: "",
    project_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch projects when modal opens to ensure fresh data
  useEffect(() => {
    if (showModal) {
      fetch("/api/nhome/projects/list", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.projects) setProjects(data.projects);
        })
        .catch((err) => console.error("Error loading projects:", err));
    }
  }, [showModal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/nhome/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create apartment");
      setMessage("✅ Apartment created successfully!");
      setForm({
        client_name: "",
        client_surname: "",
        building_number: "",
        apartment_number: "",
        apartment_type: "",
        project_id: "",
      });
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
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
        <h3 className="font-semibold text-nhome-primary">Add New Apartment</h3>
        <p className="text-sm text-slate-600 mt-1">
          Quickly register a new apartment under a project
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Add New Apartment
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Client Details */}
              <input
                type="text"
                placeholder="Client First Name"
                value={form.client_name}
                onChange={(e) =>
                  setForm({ ...form, client_name: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
              />
              <input
                type="text"
                placeholder="Client Surname"
                value={form.client_surname}
                onChange={(e) =>
                  setForm({ ...form, client_surname: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
              />

              {/* Project Selection */}
              <select
                value={form.project_id}
                onChange={async (e) => {
                  const projectId = e.target.value;
                  setForm({ ...form, project_id: projectId });

                  if (projectId) {
                    try {
                      const res = await fetch("/api/nhome/projects/list");
                      const data = await res.json();
                      if (data?.projects) {
                        const selected = data.projects.find(
                          (p: any) => p.id === projectId
                        );
                        if (selected) {
                          setAvailableTypes(selected.apartment_types || []);
                          setAvailableLotes(selected.building_numbers || []);
                        }
                      }
                    } catch (err) {
                      console.error("Error fetching project details:", err);
                    }
                  } else {
                    setAvailableTypes([]);
                    setAvailableLotes([]);
                  }
                }}
                className="border rounded-lg p-2 w-full"
                required
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Building Number */}
              <select
                value={form.building_number}
                onChange={(e) =>
                  setForm({ ...form, building_number: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
                disabled={!availableLotes.length}
              >
                <option value="">
                  {availableLotes.length
                    ? "Select Building Number"
                    : "Select a project first"}
                </option>
                {availableLotes.map((lote) => (
                  <option key={lote} value={lote}>
                    {lote}
                  </option>
                ))}
              </select>

              {/* Apartment Type */}
              <select
                value={form.apartment_type}
                onChange={(e) =>
                  setForm({ ...form, apartment_type: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
                disabled={!availableTypes.length}
              >
                <option value="">
                  {availableTypes.length
                    ? "Select Apartment Type"
                    : "Select a project first"}
                </option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              {/* Apartment Number */}
              <input
                type="text"
                placeholder="Apartment Number"
                value={form.apartment_number}
                onChange={(e) =>
                  setForm({ ...form, apartment_number: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-nhome-primary text-white py-2 rounded-lg hover:bg-nhome-secondary transition"
              >
                {loading ? "Saving..." : "Save Apartment"}
              </button>
            </form>

            {message && (
              <p className="text-sm text-center mt-3 text-slate-700">{message}</p>
            )}

            <button
              onClick={() => {
                // Reset form and message when closing modal
                setForm({
                  client_name: "",
                  client_surname: "",
                  building_number: "",
                  apartment_number: "",
                  apartment_type: "",
                  project_id: "",
                });
                setMessage("");
                setShowModal(false);
              }}
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
