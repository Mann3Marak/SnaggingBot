"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NHomeLogo } from "@/components/NHomeLogo";

interface FollowUpSession {
  id: string;
  project: string;
  unit: string;
  type: string;
  completed_at: string;
  inspection_type: string;
}

export default function NHomeFollowUpList() {
  const [sessions, setSessions] = useState<FollowUpSession[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await fetch("/api/nhome/inspections/follow-up-list");
        if (!res.ok) throw new Error("Failed to load completed inspections");
        const data = await res.json();
        setSessions(data.inspections || []);
      } catch (e) {
        console.error("Error loading follow-up list:", e);
      } finally {
        setLoading(false);
      }
    };
    loadSessions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-700">
        <NHomeLogo variant="primary" size="lg" className="mb-4" />
        <p className="text-lg font-medium">Loading completed inspections...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900">
      <div className="bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <NHomeLogo variant="white" size="md" />
            <div>
              <h1 className="font-bold text-lg">Follow-up Inspections</h1>
              <p className="text-sm opacity-90">
                Review and manage completed inspections
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-600 mt-10">
            <p>No completed inspections available for follow-up.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {s.project} — Unit {s.unit}
                  </h3>
                  <p className="text-sm text-gray-700">
                    Type: {s.type} | Inspection: {s.inspection_type}
                  </p>
                  <p className="text-xs text-gray-500">
                    Completed:{" "}
                    {s.completed_at
                      ? new Date(s.completed_at).toLocaleString()
                      : "Unknown"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    router.push(`/inspection/follow-up?sessionId=${s.id}`)
                  }
                  className="px-4 py-2 rounded-md bg-nhome-primary text-white text-sm font-medium hover:bg-nhome-secondary transition-all"
                >
                  Start Follow-up
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
