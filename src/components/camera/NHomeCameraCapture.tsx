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

export function NHomeCameraCapture({ 
  onPhotoTaken, 
  isOpen, 
  onClose, 
  inspectionItem,
  sessionData 
}: NHomeCameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [capturing, setCapturing] = useState(false)
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto')
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<{ width: number; height: number; readyState?: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewIssue, setPreviewIssue] = useState<string>('')

  const startNHomeCamera = useCallback(async (deviceId?: string) => {
    try {
      setError('')
      // Try progressively relaxed constraints for broader iOS compatibility
      const attempts: MediaStreamConstraints[] = deviceId
        ? [{ video: { deviceId: { exact: deviceId } } }]
        : [
            { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 } } },
            { video: { facingMode: { ideal: 'environment' } } },
            { video: true },
          ]

      let mediaStream: MediaStream | null = null
      let lastErr: any = null
      for (const c of attempts) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(c)
          break
        } catch (e) {
          lastErr = e
        }
      }
      if (!mediaStream) throw lastErr || new Error('Unable to access camera')

      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      setStream(mediaStream)
      setHasPermission(true)
      // Try to upgrade to true 1080p when supported
      try {
        const track = mediaStream.getVideoTracks()[0]
        const caps: any = track.getCapabilities ? (track.getCapabilities() as any) : null
        const can1080 = caps?.width && caps?.height && caps.width.max >= 1920 && caps.height.max >= 1080
        const constraints: MediaTrackConstraints = can1080
          ? { width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } }
        await track.applyConstraints(constraints)
      } catch {}
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter((d) => d.kind === 'videoinput')
        setAvailableCameras(cams)
        if (deviceId) {
          setSelectedDeviceId(deviceId)
        } else if (cams.length > 0) {
          setSelectedDeviceId(cams[0].deviceId)
        }
      } catch {}

      if (videoRef.current) {
        // iOS/Safari compatibility hints
        videoRef.current.setAttribute('autoplay', 'true')
        videoRef.current.setAttribute('muted', 'true')
        videoRef.current.setAttribute('playsinline', 'true')
        // @ts-ignore webkit attribute for older iOS
        videoRef.current.setAttribute('webkit-playsinline', 'true')
        videoRef.current.srcObject = mediaStream
        // Wait for metadata then play
        await new Promise<void>((resolve) => {
          const v = videoRef.current!
          const onReady = () => {
            v.play().then(()=>resolve()).catch(()=>resolve())
            v.removeEventListener('loadedmetadata', onReady)
          }
          if (v.readyState >= 1) {
            v.play().catch(()=>undefined)
            resolve()
          } else {
            v.addEventListener('loadedmetadata', onReady)
          }
        })
        // Verify preview renders or provide hint
        setTimeout(() => {
          const v = videoRef.current
          const ok = !!v && v.videoWidth > 0 && v.videoHeight > 0
          setPreviewIssue(ok ? '' : 'Camera stream active but preview not rendering. Try switching cameras or reload.')
          if (!ok && v) {
            try { v.srcObject = mediaStream; v.play().catch(()=>undefined) } catch {}
          }
        }, 800)
      }

    } catch (err: any) {
      console.error('NHome camera access error:', err)
      setHasPermission(false)
      
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError('Camera permission required for professional documentation. Please enable camera access in your browser settings.')
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setError('No camera found on this device. Professional documentation requires camera access.')
      } else if (err?.name === 'NotReadableError') {
        setError('Camera is in use by another app. Please close other camera apps and try again.')
      } else {
        setError('Unable to access camera. Ensure HTTPS and allow camera access, then try again.')
      }
    }
  }, [stream])

  const stopNHomeCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }, [stream])

  const restartCamera = useCallback(() => {
    startNHomeCamera(selectedDeviceId ?? undefined)
  }, [selectedDeviceId, startNHomeCamera])

  const switchCamera = useCallback(() => {
    if (availableCameras.length <= 1) return
    const currentIdx = availableCameras.findIndex((cam) => cam.deviceId === selectedDeviceId)
    const next = availableCameras[(currentIdx + 1) % availableCameras.length]
    startNHomeCamera(next.deviceId)
  }, [availableCameras, selectedDeviceId, startNHomeCamera])

  const captureNHomePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return

    setCapturing(true)

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    await addNHomeWatermark(context, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const photoUrl = URL.createObjectURL(blob)
          const metadata = createNHomePhotoMetadata()
          onPhotoTaken(blob, photoUrl, metadata)
          // Keep camera open; user can close using the header X
        }
        setCapturing(false)
      },
      'image/jpeg',
      0.95
    )
  }, [onPhotoTaken, stopNHomeCamera, onClose, capturing, inspectionItem, sessionData])

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

  // Do not auto-start on iOS; require a user gesture improves reliability
  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stopNHomeCamera()
      }
      setHasPermission(null)
      setError('')
      setPreviewIssue('')
      setDebugInfo(null)
    }
  }, [isOpen, stopNHomeCamera, stream])

  useEffect(() => {
    if (!isOpen) return
    if (stream) return
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return
    const ua = navigator.userAgent || ''
    const isIOS = /iP(ad|hone|od)/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in window)
    if (isIOS) return
    startNHomeCamera().catch(() => undefined)
  }, [isOpen, stream, startNHomeCamera])

  useEffect(() => {
    if (!stream) return
    const interval = setInterval(() => {
      const video = videoRef.current
      const track = stream.getVideoTracks()[0]
      if (!video || !track) return
      setDebugInfo({ width: video.videoWidth, height: video.videoHeight, readyState: track.readyState })
    }, 500)
    return () => clearInterval(interval)
  }, [stream])

  useEffect(() => {
    return () => stopNHomeCamera()
  }, [stopNHomeCamera])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <NHomeLogo variant="white" size="sm" />
          <div>
            <h3 className="font-bold">Professional Documentation</h3>
            {inspectionItem && (
              <p className="text-sm opacity-90">{inspectionItem.room_type} - {inspectionItem.item_description}</p>
            )}
          </div>
        </div>
        <button 
          onClick={() => {
            stopNHomeCamera()
            onClose()
          }}
          className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {sessionData && (
        <div className="bg-nhome-primary/90 text-white px-4 py-2 text-sm">
          ???? {sessionData.project_name} ??? Unit {sessionData.apartment_unit} ({sessionData.apartment_type}) ??? Professional Inspection
        </div>
      )}

      <div className="flex-1 relative bg-black">
        {hasPermission === false ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-center p-6 max-w-md">
              <div className="w-20 h-20 bg-nhome-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-4">Camera Access Required</h3>
              <p className="mb-6 text-gray-300">{error}</p>
              <button 
                onClick={() => startNHomeCamera()}
                className="bg-nhome-primary hover:bg-nhome-primary-dark text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Enable Camera for NHome Documentation
              </button>
            </div>
          </div>
        ) : hasPermission === null ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-center p-6 max-w-md">
              <div className="w-20 h-20 bg-nhome-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Enable Camera</h3>
              <p className="mb-4 text-gray-300">Tap the button below to grant camera access for professional documentation.</p>
              <button 
                onClick={() => startNHomeCamera()}
                className="bg-nhome-primary hover:bg-nhome-primary-dark text-white px-6 py-3 rounded-lg font-medium transition-colors w-full"
              >
                Allow Camera Access
              </button>
              <p className="text-xs text-gray-400 mt-3">iPhone: In Safari, tap the ???aA??? icon ??? Website Settings ??? Camera ??? Allow. Ensure you???re on HTTPS.</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {previewIssue && (
              <div className="absolute top-2 left-2 right-2 text-[11px] text-amber-200 bg-black/60 rounded px-2 py-1">
                {previewIssue}
              </div>
            )}
            {debugInfo && (
              <div className="absolute top-2 right-2 text-[10px] text-white bg-black/50 rounded px-2 py-1">
                {debugInfo.width}x{debugInfo.height} ?? {debugInfo.readyState}
              </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="flex items-center justify-center space-x-6">
                <button
                  onClick={restartCamera}
                  className="text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0 0 11.95 2.43L19 19M19 9a7 7 0 0 0-11.95-2.43L5 5" />
                  </svg>
                  <div className="text-xs mt-1">RESTART</div>
                </button>
                {availableCameras.length > 1 && (
                  <button
                    onClick={switchCamera}
                    className="text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 7h-2.59l-1.7-1.71A.996.996 0 0 0 14 5H10c-.27 0-.52.11-.71.29L7.59 7H6c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 10-4-4h3V9h2v4h3l-4 4z" />
                    </svg>
                    <div className="text-xs mt-1">SWAP</div>
                  </button>
                )}
                <button
                  onClick={() => setFlashMode(flashMode === 'auto' ? 'on' : flashMode === 'on' ? 'off' : 'auto')}
                  className="text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7,2V13H10V22L17,10H13L17,2H7Z"/>
                  </svg>
                  <div className="text-xs mt-1">{flashMode.toUpperCase()}</div>
                </button>

                <button
                  onClick={captureNHomePhoto}
                  disabled={capturing}
                  className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                    capturing 
                      ? 'bg-nhome-primary scale-95' 
                      : 'bg-white/20 hover:bg-white/30 hover:scale-105'
                  }`}
                >
                  {capturing ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  ) : (
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                      </svg>
                    </div>
                  )}
                </button>

                <button className="text-white p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4V4zm4 0v16m8-16v16M4 8h16m-16 8h16"/>
                  </svg>
                  <div className="text-xs mt-1">GRID</div>
                </button>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-white text-sm opacity-90">
                  ???? Professional documentation for NHome quality standards
                </p>
                <p className="text-white text-xs opacity-75">
                  Photo will include professional watermark and metadata
                </p>
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>

      {error && (
        <div className="bg-nhome-error text-white p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}




