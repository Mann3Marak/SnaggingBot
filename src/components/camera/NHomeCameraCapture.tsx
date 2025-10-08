"use client"
import { useState, useRef, useCallback, useEffect } from 'react'
import { NHomeLogo } from '@/components/NHomeLogo'
import type { NHomePhotoMetadata } from '@/types/nhome-photo'

interface NHomeCameraCaptureProps {
  onPhotoTaken: (photoBlob: Blob, photoUrl: string, metadata: NHomePhotoMetadata) => void
  isOpen: boolean
  onClose: () => void
  inspectionItem?: {
    id: string
    room_type: string
    item_description: string
    nhome_standard_notes?: string
  }
  sessionData?: {
    project_name: string
    apartment_unit: string
    apartment_type: string
    inspector_name: string
  }
}

import { Camera } from "react-camera-pro";

export function NHomeCameraCapture({
  onPhotoTaken,
  isOpen,
  onClose,
  inspectionItem,
  sessionData,
}: NHomeCameraCaptureProps) {
  const cameraRef = useRef<any>(null);
  const [error, setError] = useState<string>("");
  const [capturing, setCapturing] = useState(false);

  // Always call hooks before conditional returns to avoid hook order mismatch
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInitialized(true);
    }
  }, []);

  if (!initialized) return null;
  if (!isOpen) return null;

  // Simplified: react-camera-pro handles stream internally, so we remove old stream logic
  // Move capture logic outside of render cycle to prevent hook mismatch
  const handleCapture = async () => {
    try {
      setCapturing(true);
      const photo = cameraRef.current?.takePhoto?.();
      if (!photo) throw new Error("Camera not ready");
      const res = await fetch(photo);
      const blob = await res.blob();
      const metadata: NHomePhotoMetadata = {
        inspector: sessionData?.inspector_name || "NHome Inspector",
        company: "NHome Property Setup & Management",
        property: sessionData?.project_name || "Algarve Property",
        unit: sessionData?.apartment_unit || "TBD",
        room: inspectionItem?.room_type || "General",
        item: inspectionItem?.item_description || "General Documentation",
        timestamp: new Date().toISOString(),
        location: "Algarve, Portugal",
        quality_standards:
          inspectionItem?.nhome_standard_notes || "NHome Professional Standards",
      };
      onPhotoTaken(blob, photo, metadata);
    } catch (err) {
      console.error("Camera capture error:", err);
      setError("Failed to capture photo.");
    } finally {
      setCapturing(false);
    }
  };

  const addNHomeWatermark = async (context: CanvasRenderingContext2D, width: number, height: number) => {
    context.save()
    context.fillStyle = 'rgba(37, 99, 235, 0.8)'
    context.fillRect(0, height - 80, width, 80)
    context.fillStyle = 'white'
    context.font = 'bold 16px Inter, sans-serif'
    context.fillText('NHome Property Management', 20, height - 50)
    context.font = '12px Inter, sans-serif'
    const timestamp = new Date().toLocaleString('en-GB', { 
      timeZone: 'Europe/Lisbon',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    context.fillText(`${sessionData?.project_name || 'Property'} - Unit ${sessionData?.apartment_unit || 'TBD'}`, 20, height - 30)
    context.fillText(`${inspectionItem?.room_type || 'General'} ??? ${timestamp} ??? Algarve, Portugal`, 20, height - 15)
    context.font = 'bold 10px Inter, sans-serif'
    context.fillText('PROFESSIONAL INSPECTION DOCUMENTATION', width - 250, height - 15)
    context.restore()
  }

  const createNHomePhotoMetadata = (): NHomePhotoMetadata => {
    return {
      inspector: sessionData?.inspector_name || 'NHome Inspector',
      company: 'NHome Property Setup & Management',
      property: sessionData?.project_name || 'Algarve Property',
      unit: sessionData?.apartment_unit || 'TBD',
      room: inspectionItem?.room_type || 'General',
      item: inspectionItem?.item_description || 'General Documentation',
      timestamp: new Date().toISOString(),
      location: 'Algarve, Portugal',
      quality_standards: inspectionItem?.nhome_standard_notes || 'NHome Professional Standards'
    }
  }

  // react-camera-pro handles permissions and lifecycle automatically
  // Remove redundant useEffect to prevent hook count mismatch
  // Error state is already initialized and reset on capture

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-[90vw] max-w-md">
        <div className="flex justify-between items-center bg-nhome-primary text-white px-4 py-2">
          <h3 className="font-semibold text-sm">Professional Camera</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            ✕
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          <Camera
            ref={cameraRef}
            facingMode="environment"
            errorMessages={{
              noCameraAccessible: "No camera found on this device.",
              permissionDenied: "Camera permission denied.",
              switchCamera: "Unable to switch camera.",
              canvas: "Camera error.",
            }}
          />
        </div>

        {/* Zoom slider for iPhone */}
        <div className="flex flex-col items-center justify-center bg-gray-800 py-3">
          <label className="text-white text-sm mb-1">Zoom</label>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            defaultValue="1"
            onChange={(e) => {
              const zoomValue = parseFloat(e.target.value);
              try {
                const track = cameraRef.current?.stream?.getVideoTracks?.()[0];
                const capabilities = track?.getCapabilities?.();
                if (capabilities?.zoom) {
                  track.applyConstraints({ advanced: [{ zoom: zoomValue }] });
                }
              } catch (err) {
                console.warn("Zoom not supported on this device:", err);
              }
            }}
            className="w-3/4 accent-nhome-primary"
          />
        </div>

        <div className="flex justify-center items-center gap-6 py-4 bg-gray-900">
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="bg-nhome-primary text-white px-6 py-3 rounded-full font-medium hover:bg-nhome-primary-dark transition"
          >
            {capturing ? "Capturing..." : "Capture"}
          </button>
        </div>

        {error && (
          <div className="bg-red-600 text-white text-center py-2 text-sm">{error}</div>
        )}
      </div>
    </div>
  );
}
