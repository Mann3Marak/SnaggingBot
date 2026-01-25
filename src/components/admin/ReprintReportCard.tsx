"use client";
import { useState } from "react";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function ReprintReportCard() {
  const { user } = useAuthUser();
  const [showModal, setShowModal] = useState(false);

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
          Regenerate and download an existing inspection report
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Reprint Report
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-600">
                  Backend integration pending. This modal will allow selecting and reprinting reports.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Select Inspection
                </label>
                <select
                  disabled
                  className="border rounded-lg p-2 w-full bg-slate-100 cursor-not-allowed"
                >
                  <option>Select an inspection...</option>
                </select>

                <label className="block text-sm font-medium text-slate-700">
                  Report Language
                </label>
                <select
                  disabled
                  className="border rounded-lg p-2 w-full bg-slate-100 cursor-not-allowed"
                >
                  <option>English</option>
                  <option>Portuguese</option>
                </select>
              </div>

              <button
                disabled
                className="w-full bg-nhome-primary text-white py-2 rounded-lg opacity-50 cursor-not-allowed"
              >
                Generate Report
              </button>
            </div>

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
