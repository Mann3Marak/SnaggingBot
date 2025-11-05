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
  const [zoom, setZoom] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Always call hooks before conditional returns to avoid hook order mismatch
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInitialized(true);
      // Detect mobile device
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
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

  // react-camera-pro handles permissions and lifecycle automatically
  // Remove redundant useEffect to prevent hook count mismatch
  // Error state is already initialized and reset on capture

  // Handle zoom for devices that support it
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    try {
      const track = cameraRef.current?.stream?.getVideoTracks?.()?.[0];
      const capabilities = track?.getCapabilities?.();
      if (capabilities?.zoom) {
        track.applyConstraints({
          advanced: [{ zoom: newZoom }]
        }).catch(() => {
          console.warn("Zoom constraint failed");
        });
      }
    } catch (err) {
      // Silently fail - zoom not supported
    }
  };

  // Mobile: full-screen with safe areas
  // Desktop: large modal
  const containerClass = isMobile
    ? "fixed inset-0 bg-black z-50 flex flex-col"
    : "fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4";

  const modalClass = isMobile
    ? "w-full h-full flex flex-col"
    : "bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col";

  return (
    <div className={containerClass}>
      <div className={modalClass}>
        {/* Header */}
        <div className="flex justify-between items-center bg-nhome-primary text-white px-4 py-3 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-base">Inspection Camera</h3>
            {inspectionItem && (
              <p className="text-xs text-white/80 mt-0.5">
                {inspectionItem.room_type} - {inspectionItem.item_description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl leading-none p-1"
            aria-label="Close camera"
          >
            ✕
          </button>
        </div>

        {/* Camera Preview - Takes remaining space */}
        <div className="relative flex-1 bg-black overflow-hidden">
          <div
            className="w-full h-full"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.1s ease-out',
            }}
          >
            <Camera
              ref={cameraRef}
              facingMode="environment"
              aspectRatio={isMobile ? 3/4 : 16/9}
              errorMessages={{
                noCameraAccessible: "No camera found on this device.",
                permissionDenied: "Camera permission denied. Please enable camera access in your browser settings.",
                switchCamera: "Unable to switch camera.",
                canvas: "Camera error occurred.",
              }}
            />
          </div>

          {/* Zoom indicator overlay */}
          {zoom > 1 && (
            <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium">
              {zoom.toFixed(1)}x
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-900 flex-shrink-0">
          {/* Zoom slider */}
          <div className="flex items-center justify-center gap-3 px-6 py-3 border-b border-gray-700">
            <span className="text-white text-sm font-medium">🔍</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="flex-1 max-w-md h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-nhome-primary"
              aria-label="Zoom level"
            />
            <span className="text-white text-sm font-medium w-12 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Capture button */}
          <div className="flex justify-center items-center gap-4 py-4 px-6">
            <button
              onClick={onClose}
              className="bg-gray-700 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCapture}
              disabled={capturing}
              className="bg-nhome-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-nhome-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {capturing ? "📸 Capturing..." : "📸 Capture Photo"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white text-center py-3 px-4 text-sm font-medium flex-shrink-0">
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}
