"use client";
import { useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useAuthUser } from "@/hooks/useAuthUser";

// Types
interface Inspection {
  id: string;
  clientName: string;
  apartmentDetails: string;
  status: "in_progress" | "completed" | "cancelled";
}

interface Project {
  id: string;
  name: string;
}

// Mock data (will be replaced with API calls later)
const MOCK_PROJECTS: Project[] = [
  { id: "1", name: "Lote 6" },
  { id: "2", name: "Marina Gardens" },
  { id: "3", name: "Ocean View" },
];

const MOCK_INSPECTIONS: Record<string, Inspection[]> = {
  "1": [
    { id: "a1", clientName: "Dayne Roberts", apartmentDetails: "Lote 6, 5-2A", status: "in_progress" },
    { id: "a2", clientName: "Sarah Miller", apartmentDetails: "Lote 6, 3-1B", status: "completed" },
    { id: "a3", clientName: "John Smith", apartmentDetails: "Lote 6, 2-4C", status: "completed" },
    { id: "a4", clientName: "Maria Garcia", apartmentDetails: "Lote 6, 4-3A", status: "in_progress" },
    { id: "a5", clientName: "James Wilson", apartmentDetails: "Lote 6, 1-1A", status: "completed" },
  ],
  "2": [
    { id: "b1", clientName: "Emma Wilson", apartmentDetails: "Marina Gardens, T2-A", status: "in_progress" },
    { id: "b2", clientName: "Michael Brown", apartmentDetails: "Marina Gardens, T3-B", status: "cancelled" },
  ],
  "3": [
    { id: "c1", clientName: "Lisa Johnson", apartmentDetails: "Ocean View, 101", status: "completed" },
  ],
};

// Status badge component
function StatusBadge({ status }: { status: Inspection["status"] }) {
  const styles = {
    completed: "bg-green-100 text-green-700",
    in_progress: "bg-amber-100 text-amber-700",
    cancelled: "bg-slate-100 text-slate-600",
  };

  const labels = {
    completed: "Completed",
    in_progress: "In Progress",
    cancelled: "Cancelled",
  };

  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function DeleteInspectionCard() {
  const { user } = useAuthUser();
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectionToDelete, setInspectionToDelete] = useState<Inspection | null>(null);

  // Only admins can see this card
  if (!user || user.role !== "admin") return null;

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value;
    setSelectedProject(projectId);
    if (projectId) {
      // TODO: Replace with API call
      setInspections(MOCK_INSPECTIONS[projectId] || []);
    } else {
      setInspections([]);
    }
  };

  const handleDeleteClick = (inspection: Inspection) => {
    setInspectionToDelete(inspection);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    if (inspectionToDelete) {
      // TODO: Replace with API call
      setInspections((prev) => prev.filter((i) => i.id !== inspectionToDelete.id));
      setShowConfirmModal(false);
      setInspectionToDelete(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProject("");
    setInspections([]);
  };

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <TrashIcon className="h-6 w-6 text-nhome-primary" />
          <h3 className="font-semibold text-nhome-primary">Delete Inspection</h3>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Remove an inspection and all associated data
        </p>
      </div>

      {/* Main Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold text-nhome-primary mb-4">
              Delete Inspection
            </h2>

            {/* Project Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Project
              </label>
              <select
                value={selectedProject}
                onChange={handleProjectChange}
                className="border border-slate-300 rounded-lg p-2 w-full focus:ring-2 focus:ring-nhome-primary focus:border-nhome-primary"
              >
                <option value="">Select a project...</option>
                {MOCK_PROJECTS.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Inspection List */}
            {selectedProject && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {inspections.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No inspections found for this project.
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-80 border border-slate-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                            Client Details
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                            Apartment Details
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-700">
                            Status
                          </th>
                          <th className="px-4 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspections.map((inspection, index) => (
                          <tr
                            key={inspection.id}
                            className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                          >
                            <td className="px-4 py-3 text-sm text-slate-900">
                              {inspection.clientName}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {inspection.apartmentDetails}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={inspection.status} />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteClick(inspection)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                                title="Delete inspection"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Placeholder when no project selected */}
            {!selectedProject && (
              <div className="text-center py-8 text-slate-500">
                Select a project to view inspections.
              </div>
            )}

            <button
              onClick={handleCloseModal}
              className="mt-4 w-full text-sm text-slate-500 hover:text-nhome-primary py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && inspectionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Confirm Deletion
            </h3>
            <p className="text-slate-600 mb-4">
              Are you sure you want to delete this inspection?
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="font-medium text-slate-900">{inspectionToDelete.clientName}</p>
              <p className="text-sm text-slate-600">{inspectionToDelete.apartmentDetails}</p>
            </div>
            <p className="text-sm text-red-600 mb-4">
              This action cannot be undone. All associated data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
