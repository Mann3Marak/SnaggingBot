"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { NHomeLogo } from "@/components/NHomeLogo";

interface FollowUpPhoto {
  id: string;
  url: string;
  file_name: string;
  created_at: string;
}

interface FollowUpItem {
  id: string;
  unit_number?: string;
  apartment_type?: string;
  description: string;
  room_type: string;
  status: "issue" | "critical";
  fixed: boolean;
  comment?: string;
  photos: FollowUpPhoto[];
  showComment?: boolean;
  showPhotos?: boolean;
  changed?: boolean; // Track if item was modified
}

export default function NHomeFollowUpInspection() {
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionInfo, setSessionInfo] = useState<{ unit_number?: string; apartment_type?: string; project_name?: string } | null>(null);

  // Load follow-up items from backend
  const loadFollowUpItems = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nhome/inspections/${id}/follow-up`);
      if (!res.ok) throw new Error("Failed to load follow-up items");
      const data = await res.json();
      // Deep clone items to ensure independent state per item
      const clonedItems = (data.followUpItems || []).map((item: any) => ({
        ...item,
        fixed: Boolean(item.fixed),
        comment: item.comment || "",
        photos: item.photos || [],
        showComment: false,
        showPhotos: false,
      }));
      setItems(clonedItems);
      setSessionInfo(data.session || null);
      setSessionId(id);
    } catch (e) {
      console.error("Error loading follow-up items:", e);
    } finally {
      setLoading(false);
    }
  };

  // Automatically load sessionId from query string
  const searchParams = useSearchParams();
  const querySessionId = searchParams?.get("sessionId");

  useEffect(() => {
    if (querySessionId && !sessionId) {
      loadFollowUpItems(querySessionId);
    }
  }, [querySessionId, sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800">
        <NHomeLogo variant="primary" size="lg" className="mb-6" />
        <h1 className="text-2xl font-semibold mb-4">Loading Follow-up Inspection...</h1>
        <p className="text-sm text-gray-500">Please wait while we load your inspection data.</p>
      </div>
    );
  }

  const toggleFixed = (id: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          // Toggle only the selected item and mark as changed
          return { ...item, fixed: !item.fixed, changed: true };
        }
        return item;
      })
    );
  };

  const toggleComment = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, showComment: !item.showComment }
          : item
      )
    );
  };

  const togglePhotos = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, showPhotos: !item.showPhotos }
          : item
      )
    );
  };

  const updateComment = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, comment: value, changed: true } : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900">
      <div className="bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <NHomeLogo variant="white" size="md" />
            <div>
              <h1 className="font-bold text-lg">NHome Professional Follow-up</h1>
              <p className="text-sm opacity-90">Review and verify previous issues</p>
            </div>
          </div>
          {sessionInfo && (
            <div className="text-right text-sm">
              <div className="font-medium">
                Unit {sessionInfo.unit_number || "N/A"}
              </div>
              <div className="opacity-90">
                {sessionInfo.apartment_type || "TBD"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold mb-4 text-nhome-primary">
          Outstanding Items
        </h2>

        {items.length === 0 ? (
          <p className="text-gray-600">No outstanding issues found.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-nhome-primary/10 text-nhome-primary">
                        {item.room_type}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium ${
                          item.status === "critical"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-2">
                      {item.description}
                    </h3>

                    {item.comment && !item.showComment && (
                      <div className="mt-2 bg-gray-50 border-l-4 border-nhome-primary p-2 rounded text-sm text-gray-700">
                        <strong>Comment:</strong> {item.comment}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => toggleFixed(item.id)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                        item.fixed
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {item.fixed ? "Fixed ✓" : "Mark Fixed"}
                    </button>

                    {item.photos && item.photos.length > 0 && (
                      <button
                        onClick={() => togglePhotos(item.id)}
                        className="px-4 py-1.5 rounded-md bg-blue-500 text-white text-sm hover:bg-blue-600 whitespace-nowrap"
                      >
                        {item.showPhotos ? "Hide Photos" : `View Photos (${item.photos.length})`}
                      </button>
                    )}

                    <button
                      onClick={() => toggleComment(item.id)}
                      className="px-4 py-1.5 rounded-md bg-nhome-primary text-white text-sm hover:bg-nhome-secondary whitespace-nowrap"
                    >
                      {item.showComment ? "Hide Comment" : "Add Comment"}
                    </button>
                  </div>
                </div>

                {item.showPhotos && item.photos && item.photos.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Issue Photos:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {item.photos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.url}
                            alt={photo.file_name}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(photo.url, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to enlarge
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {item.showComment && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add/Edit Comment:
                    </label>
                    <textarea
                      value={item.comment || ""}
                      onChange={(e) =>
                        updateComment(item.id, e.target.value)
                      }
                      placeholder="Add your comment here..."
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-nhome-primary"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={async () => {
              try {
                // Only send changed items to backend
                const changedItems = items.filter((i) => i.changed);
                const res = await fetch(`/api/nhome/inspections/${sessionId}/follow-up`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sessionId,
                    updates: changedItems.map((i) => ({
                      id: i.id,
                      fixed: i.fixed,
                      comment: i.comment,
                    })),
                  }),
                });
                if (!res.ok) throw new Error("Failed to save follow-up results");
                alert("Follow-up results saved successfully!");
              } catch (e) {
                console.error("Error saving follow-up results:", e);
                alert("Error saving follow-up results. Check console for details.");
              }
            }}
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white font-semibold shadow-md hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Follow-up Results"}
          </button>
        </div>
      </div>
    </div>
  );
}
