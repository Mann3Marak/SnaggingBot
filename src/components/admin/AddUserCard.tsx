"use client";
import { useMemo, useState } from "react";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function AddUserCard() {
  const { user } = useAuthUser();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "inspector" as "admin" | "manager" | "inspector",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canSubmit = useMemo(() => {
    return (
      form.fullName.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.password.length >= 8 &&
      form.confirmPassword.length >= 8 &&
      form.password === form.confirmPassword &&
      !submitting
    );
  }, [form, submitting]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (form.password !== form.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create user");

      setSuccessMessage(`User created: ${json?.user?.email || form.email.trim()}`);
      setForm({
        fullName: "",
        email: "",
        role: "inspector",
        password: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAndClose() {
    setShowModal(false);
    setSubmitting(false);
    setErrorMessage("");
    setSuccessMessage("");
    setForm({
      fullName: "",
      email: "",
      role: "inspector",
      password: "",
      confirmPassword: "",
    });
  }

  // Only admins can see this card
  if (!user || user.role !== "admin") return null;

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <UserPlusIcon className="h-6 w-6 text-nhome-primary" />
          <h3 className="font-semibold text-nhome-primary">Add User</h3>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Create a new user account with role assignment
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Add New User
            </h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  disabled={submitting}
                  className="border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                  required
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={submitting}
                  className="border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                  required
                />
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      role: e.target.value as "admin" | "manager" | "inspector",
                    }))
                  }
                  disabled={submitting}
                  className="border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="inspector">Inspector</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  type="password"
                  placeholder="Temporary Password (min 8 chars)"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  disabled={submitting}
                  className="border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                  minLength={8}
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  disabled={submitting}
                  className="border border-slate-300 rounded-lg p-2 w-full disabled:bg-slate-100 disabled:cursor-not-allowed"
                  minLength={8}
                  required
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-nhome-primary text-white py-2 rounded-lg hover:bg-nhome-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Creating..." : "Create User"}
              </button>
            </form>

            <button
              onClick={resetAndClose}
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
