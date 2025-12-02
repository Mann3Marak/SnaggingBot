"use client"
import { useState, useRef, useCallback, useEffect, ChangeEvent } from 'react'
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>("");
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setError("");
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

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError("");

      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError("Please select an image file.");
        return;
      }

      // Validate file size (max 10MB before compression)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError("Image too large. Maximum size is 10MB.");
        return;
      }

      console.log('[Photo Upload] Processing image:', file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`);

      // Extract EXIF data
      const exifData = await extractExifData(file);
      console.log('[EXIF] Extracted data:', exifData);

      // Compress image if larger than 2MB
      let blob: Blob;
      const shouldCompress = file.size > 2 * 1024 * 1024; // 2MB threshold

      if (shouldCompress) {
        console.log('[Photo Upload] Compressing image...');
        blob = await compressImage(file);
      } else {
        console.log('[Photo Upload] No compression needed');
        blob = file as Blob;
      }

      const url = URL.createObjectURL(blob);

      // Create metadata (same structure as camera capture)
      // Use EXIF timestamp if available, otherwise current time
      const timestamp = exifData.timestamp || new Date().toISOString();

      const metadata: NHomePhotoMetadata = {
        inspector: sessionData?.inspector_name || "NHome Inspector",
        company: "NHome Property Setup & Management",
        property: sessionData?.project_name || "Algarve Property",
        unit: sessionData?.apartment_unit || "TBD",
        room: inspectionItem?.room_type || "General",
        item: inspectionItem?.item_description || "General Documentation",
        timestamp,
        location: "Algarve, Portugal",
        quality_standards:
          inspectionItem?.nhome_standard_notes || "NHome Professional Standards",
      };

      console.log('[Photo Upload] Final blob size:', `${(blob.size / 1024 / 1024).toFixed(2)}MB`);

      // Use the same callback as camera capture
      onPhotoTaken(blob, url, metadata);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error("File upload error:", err);
      setError("Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Compress image if needed using Canvas API
   */
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Determine if compression is needed
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        const QUALITY = 0.85;

        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`[Photo Compression] Original: ${(file.size / 1024 / 1024).toFixed(2)}MB -> Compressed: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  };

  /**
   * Extract EXIF data from image file
   */
  const extractExifData = async (file: File): Promise<{ timestamp?: string; gps?: { lat: number; lng: number } }> => {
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // Check for JPEG signature
      if (view.getUint16(0, false) !== 0xFFD8) {
        return {}; // Not a JPEG
      }

      let offset = 2;
      const length = view.byteLength;

      // Find EXIF marker (0xFFE1)
      while (offset < length) {
        const marker = view.getUint16(offset, false);

        if (marker === 0xFFE1) {
          // Found EXIF marker
          const exifLength = view.getUint16(offset + 2, false);
          const exifString = String.fromCharCode(
            view.getUint8(offset + 4),
            view.getUint8(offset + 5),
            view.getUint8(offset + 6),
            view.getUint8(offset + 7)
          );

          if (exifString === 'Exif') {
            // Basic EXIF parsing - extract DateTime if available
            // This is a simplified implementation
            // For production, consider using a library like exif-js
            console.log('[EXIF] EXIF data found in image');

            // Try to extract file modification date as fallback
            const lastModified = new Date(file.lastModified).toISOString();
            return { timestamp: lastModified };
          }
        }

        // Move to next marker
        const segmentLength = view.getUint16(offset + 2, false);
        offset += 2 + segmentLength;
      }

      return {};
    } catch (err) {
      console.warn('[EXIF] Failed to extract EXIF data:', err);
      return {};
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

          {/* Capture and Upload buttons */}
          <div className="flex justify-center items-center gap-3 py-4 px-4">
            <button
              onClick={onClose}
              className="bg-gray-700 text-white px-4 py-2.5 rounded-full font-medium hover:bg-gray-600 transition text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadClick}
              disabled={uploading || capturing}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              {uploading ? "📤 Uploading..." : "📁 Choose from Gallery"}
            </button>
            <button
              onClick={handleCapture}
              disabled={capturing || uploading}
              className="bg-nhome-primary text-white px-6 py-2.5 rounded-full font-semibold hover:bg-nhome-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              {capturing ? "📸 Capturing..." : "📸 Take Photo"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white text-center py-3 px-4 text-sm font-medium flex-shrink-0">
            ⚠️ {error}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload photo from gallery"
        />
      </div>
    </div>
  );
}
