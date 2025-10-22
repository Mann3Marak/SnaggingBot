"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function AddApartmentCard() {
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
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

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data }) => setProjects(data || []));
  }, []);

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
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Client Name"
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
              </div>
              <input
                type="text"
                placeholder="Building Number"
                value={form.building_number}
                onChange={(e) =>
                  setForm({ ...form, building_number: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
              />
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
              <input
                type="text"
                placeholder="Apartment Type (e.g. T2)"
                value={form.apartment_type}
                onChange={(e) =>
                  setForm({ ...form, apartment_type: e.target.value })
                }
                className="border rounded-lg p-2 w-full"
                required
              />
              <select
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
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
              onClick={() => setShowModal(false)}
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
