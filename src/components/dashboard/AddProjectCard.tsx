"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function AddProjectCard() {
  const { user } = useAuthUser();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    developer_name: "",
    developer_contact_email: "",
    developer_contact_phone: "",
    address: "",
    apartment_types: [] as string[],
    building_numbers: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Only admins can see this card
  if (!user || user.role !== "admin") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/nhome/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          created_by: user?.id || null,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create project");

      setMessage("✅ Project created successfully!");
      setForm({
        name: "",
        developer_name: "",
        developer_contact_email: "",
        developer_contact_phone: "",
        address: "",
        apartment_types: [],
        building_numbers: [],
      });
    } catch (err: any) {
      console.error("Error creating project:", err);
      setMessage(`❌ ${err.message || "Failed to create project"}`);
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
        <h3 className="font-semibold text-nhome-primary">Create New Project</h3>
        <p className="text-sm text-slate-600 mt-1">
          Add a new project to manage apartments and inspections
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Create New Project
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Project Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border rounded-lg p-2 w-full"
                required
              />
              <input
                type="text"
                placeholder="Developer Name"
                value={form.developer_name}
                onChange={(e) =>
                  setForm({ ...form, developer_name: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
              />
              <input
                type="email"
                placeholder="Developer Contact Email"
                value={form.developer_contact_email}
                onChange={(e) =>
                  setForm({ ...form, developer_contact_email: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
              />
              <input
                type="text"
                placeholder="Developer Contact Phone"
                value={form.developer_contact_phone}
                onChange={(e) =>
                  setForm({ ...form, developer_contact_phone: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
              />
              <input
                type="text"
                placeholder="Project Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="border rounded-lg p-2 w-full"
                required
              />

              <div className="mt-4">
                <p className="font-medium text-sm text-slate-700 mb-2">
                  Select Apartment Types
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "T1",
                    "T1+1",
                    "T2",
                    "T2+1",
                    "T3",
                    "T3+1",
                    "T4",
                    "T4+1",
                    "T5",
                  ].map((type) => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.apartment_types.includes(type)}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...form.apartment_types, type]
                            : form.apartment_types.filter((t) => t !== type);
                          setForm({ ...form, apartment_types: updated });
                        }}
                        className="accent-nhome-primary"
                      />
                      <span className="text-sm text-slate-700">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="font-medium text-sm text-slate-700 mb-2">
                  Select Building Numbers
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 10 }, (_, i) => `Lote ${i + 1}`).map(
                    (lote) => (
                      <label key={lote} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={form.building_numbers.includes(lote)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...form.building_numbers, lote]
                              : form.building_numbers.filter((b) => b !== lote);
                            setForm({ ...form, building_numbers: updated });
                          }}
                          className="accent-nhome-primary"
                        />
                        <span className="text-sm text-slate-700">{lote}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-nhome-primary text-white py-2 rounded-lg hover:bg-nhome-secondary transition"
              >
                {loading ? "Saving..." : "Save Project"}
              </button>
            </form>

            {message && (
              <p className="text-sm text-center mt-3 text-slate-700">{message}</p>
            )}

            <button
              onClick={() => {
                setForm({
                  name: "",
                  developer_name: "",
                  developer_contact_email: "",
                  developer_contact_phone: "",
                  address: "",
                  apartment_types: [],
                  building_numbers: [],
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
