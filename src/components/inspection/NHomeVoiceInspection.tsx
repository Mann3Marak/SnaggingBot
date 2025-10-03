"use client"
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useState as useLocalState } from 'react'
import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { NHomeLogo } from '@/components/NHomeLogo'
import { useNHomePhotoCapture } from '@/hooks/useNHomePhotoCapture'
import { NHomePhotoUploadService } from '@/services/nhomePhotoUploadService'
import { NHomeCameraCapture } from '@/components/camera/NHomeCameraCapture'
import { ConnectOneDrive } from '@/components/onedrive/ConnectOneDrive'

interface NHomeVoiceInspectionProps {
  sessionId: string
  onRefreshReport?: () => void
}

// Legacy classification retained for reference; no current references.
// type VoiceAssessment = 'good' | 'issue' | 'critical'

export function NHomeVoiceInspection({ sessionId, onRefreshReport }: NHomeVoiceInspectionProps) {
  const { session, currentItem, nhomeProgress, saveNHomeResult } = useNHomeInspectionSession(sessionId)
  const [processing, setProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState('')

  // Realtime voice session removed. Placeholder state for STT/TTS integration.
  const [userTurns, setUserTurns] = useLocalState<string[]>([])
  const [assistantMessages, setAssistantMessages] = useLocalState<string[]>([])
  const [isRecording, setIsRecording] = useLocalState(false)
  const status = isRecording ? "Recording..." : "Idle"
  const [liveUserTranscript, setLiveUserTranscript] = useLocalState<string>("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const sendTextMessage = async (message: string, role: string = "user", addToTurns = false) => {
    if (addToTurns) {
      setUserTurns(prev => [...prev, message])
    }
    // Call TTS API to play assistant response
    try {
      const resp = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message })
      })
      if (resp.ok) {
        const audioBlob = await resp.blob()
        const url = URL.createObjectURL(audioBlob)
        const audio = new Audio(url)
        audio.play()
      }
    } catch (e) {
      console.error("TTS playback failed", e)
    }
    setAssistantMessages(prev => [...prev, message])
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const formData = new FormData()
        formData.append("file", audioBlob, "input.webm")

        try {
          const resp = await fetch("/api/voice/stt", {
            method: "POST",
            body: formData,
          })
          if (resp.ok) {
            const data = await resp.json()
            const transcript = data.text
            setLiveUserTranscript(transcript)
            setUserTurns(prev => [...prev, transcript])
          } else {
            console.error("STT request failed")
          }
        } catch (err) {
          console.error("STT error", err)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error("Mic access denied or error:", err)
    }
  }

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      return
    }

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
    } catch (error) {
      console.error('Failed to stop recording cleanly:', error)
    }

    try {
      recorder.stream?.getTracks().forEach(track => {
        track.stop()
      })
    } catch (error) {
      console.error('Failed to release audio stream:', error)
    }

    mediaRecorderRef.current = null
    setIsRecording(false)
  }, [])

  const resetTranscripts = () => {
    setUserTurns([])
    setAssistantMessages([])
  }

  const updateSessionInstructions = (_: string) => {
    // no-op for now
  }

  const isProcessingTurnRef = useRef(false)
  

  const {
    isCameraOpen,
    openNHomeCamera,
    closeNHomeCamera,
    addNHomePhoto,
    getNHomePhotosForItem,
    generateNHomeFileName,
    removeNHomePhoto,
    markPhotoUploaded,
    updateUploadProgress,
    uploadProgress,
  } = useNHomePhotoCapture()
  const uploader = useRef(new NHomePhotoUploadService()).current

  useEffect(() => {
    return () => {
      if (isRecording || mediaRecorderRef.current) {
        stopRecording()
      }
    }
  }, [isRecording, stopRecording])

  const enhanceNHomeDescription = useCallback(async (userInput: string, item = currentItem) => {
    const trimmed = userInput.trim()
    if (!item || !session) {
      return trimmed
    }

    try {
      const response = await fetch('/api/nhome/enhance-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: trimmed,
          item: item.item_description,
          room: item.room_type,
          nhome_standards: item.nhome_standard_notes,
          property_type: session.apartment?.apartment_type,
          location: session.project?.address ?? 'Algarve, Portugal',
        }),
      })

      if (!response.ok) {
        throw new Error(`Enhancement failed (${response.status})`)
      }

      const { enhanced } = await response.json()
      if (typeof enhanced === 'string' && enhanced.trim()) {
        return enhanced.trim()
      }
      return trimmed
    } catch (error) {
      console.error('Enhancement error:', error)
      return trimmed
    }
  }, [currentItem, session])
  /*
   Legacy assessor retained for reference - replaced by server-side agent.
   const categorizeAssessment = useCallback((input: string): VoiceAssessment => {
     const normalized = input.trim().toLowerCase()
     const isGoodCondition = /^(good|fine|ok|okay|perfect|excellent|no issues?|meets standards?|nhome standard)$/i.test(normalized)
     if (isGoodCondition) {
       return 'good'
     }
     const isCriticalIssue = /(critical|urgent|major|serious|dangerous|immediate|safety|structural|flood|gas)/i.test(normalized)
     if (isCriticalIssue) {
       return 'critical'
     }
     // Default to issue if not good or critical
     return 'issue'
   }, [])
  */


  const inspectionInstructions = useMemo(() => {
    if (!session) {
      return ''
    }
    const projectName = session.project?.name || 'Algarve Property'
    const developer = session.project?.developer_name || 'Local Developer'
    const unitNumber = session.apartment?.unit_number || 'Unit'
    const apartmentType = session.apartment?.apartment_type || 'Residence'
    const currentRoom = currentItem?.room_type || 'General'
    const currentDescription = currentItem?.item_description || 'inspection item'

    return `You are the professional voice assistant for NHome Property Management conducting inspections in the Algarve.
Project: ${projectName}
Developer: ${developer}
Unit: ${unitNumber} (${apartmentType})
Current focus: ${currentRoom} - ${currentDescription}
Maintain Natalie O'Kelly's professional standards, reference Algarve-specific considerations, and keep guidance concise, actionable, and thorough.`
  }, [currentItem, session])

  // Legacy front-end handler retained for reference; backend agent handles turns now.
//   const handleNHomeVoiceResponse = useCallback(async (userInput: string) => {
//     setProcessing(true)
//     try {
//       // Call a backend agent endpoint to generate a dynamic response
//       const resp = await fetch("/api/nhome/agent", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           instructions: inspectionInstructions,
//           messages: [
//             { role: "user", content: userInput }
//           ],
//           sessionId
//         })
//       })
//       if (resp.ok) {
//         const data = await resp.json()
//         const reply = data.reply || "I heard you."
//         setLastResponse(reply)
//         sendTextMessage(reply, "assistant", true)
//       } else {
//         console.error("Agent request failed")
//         setLastResponse("Agent request failed")
//       }
//     } catch (error) {
//       console.error("Error processing NHome voice response:", error)
//       setLastResponse("Unable to process your request.")
//     } finally {
//       setProcessing(false)
//     }
//   }, [sessionId, sendTextMessage, inspectionInstructions])

  useEffect(() => {
    if (userTurns.length === 0) return
    const latestTurn = userTurns[userTurns.length - 1]

    // Only process if not already processing
    if (!isProcessingTurnRef.current) {
      isProcessingTurnRef.current = true
      ;(async () => {
        try {
          // Instead of front-end deciding, delegate to backend agent
          const resp = await fetch("/api/nhome/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instructions: inspectionInstructions,
              messages: [
                { role: "user", content: latestTurn }
              ],
              sessionId,
              currentItem,
              nhomeProgress
            })
          })
          if (resp.ok) {
            const data = await resp.json()
            const reply = data.reply || "I heard you."
            setLastResponse(reply)
            await sendTextMessage(reply, "assistant", true)

            // Detect special action phrase from agent
            if (reply.includes("Moving to the next item")) {
              // Advance to next item in the inspection session
              if (currentItem) {
                // Default to "good" if agent said item is good
                await saveNHomeResult(currentItem.id, "good", "Meets NHome standards")
                onRefreshReport?.()
              }
            }
          } else {
            await sendTextMessage("Agent could not process input.", "assistant", true)
          }
        } finally {
          setUserTurns([])
          isProcessingTurnRef.current = false
        }
      })()
    }
  }, [inspectionInstructions, sessionId, currentItem, nhomeProgress, userTurns, sendTextMessage])


  useEffect(() => {
    if (!isRecording) {
      return
    }
    if (inspectionInstructions) {
      updateSessionInstructions(inspectionInstructions)
    }

  }, [currentItem, inspectionInstructions, isRecording, sendTextMessage, session, updateSessionInstructions])

  const handleToggleAssistant = useCallback(async () => {
    if (isRecording) {
      stopRecording()
      return
    }
    try {
      setLastResponse('')
      resetTranscripts()
      await startRecording()
    } catch (error) {
      console.error('Failed to start recording session:', error)
    }
  }, [isRecording, resetTranscripts, startRecording, stopRecording])

  const activeStatus = processing
    ? 'Processing the latest NHome assessment...'
    : isRecording
      ? 'NHome Assistant is listening. Speak now.'
      : 'Tap to start recording your input.'

  const userTranscriptSegments = useMemo(() => {
    const segments = [...userTurns]
    if (liveUserTranscript) {
      segments.push(`Listening: ${liveUserTranscript}`)
    }
    return segments
  }, [liveUserTranscript, userTurns])

  if (!session || !currentItem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading NHome inspection...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="bg-gradient-to-r from-nhome-primary to-nhome-secondary text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <NHomeLogo variant="white" size="md" />
            <div>
              <h1 className="font-bold text-lg">NHome Professional Inspection</h1>
              <p className="text-sm opacity-90">{session.project.name}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">Unit {session.apartment.unit_number}</div>
            <div className="opacity-90">{session.apartment.apartment_type}</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <ConnectOneDrive />
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-nhome-primary to-nhome-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-nhome-primary mb-2">
              {currentItem.room_type}
            </h2>
            <p className="text-lg text-gray-700 mb-4">
              {currentItem.item_description}
            </p>

            {currentItem.nhome_standard_notes && (
              <div className="bg-nhome-primary/10 border border-nhome-primary/20 rounded-lg p-3 text-sm text-nhome-primary">
                <strong>NHome Standards:</strong> {currentItem.nhome_standard_notes}
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Inspection Progress</span>
              <span>{nhomeProgress.completed} of {nhomeProgress.total} items</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-nhome-primary to-nhome-secondary h-3 rounded-full transition-all duration-500"
                style={{ width: `${(nhomeProgress.completed / nhomeProgress.total) * 100}%` }}
              />
            </div>

            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Quality Score: {nhomeProgress.quality_score}/10</span>
              <span>Issues Found: {nhomeProgress.issues_found}</span>
            </div>
          </div>

          <div className="text-center space-y-4">
            <button
              onClick={handleToggleAssistant}
              className={`w-24 h-24 rounded-full font-bold text-white transition-all duration-200 transform ${
                isRecording
                  ? 'bg-nhome-error animate-pulse scale-110 shadow-xl'
                  : 'bg-nhome-success hover:scale-105 shadow-lg hover:shadow-xl'
              }`}
            >
              {isRecording ? (
                <div className="space-y-1">
                  <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                  <div className="text-xs">STOP</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                  <div className="text-xs">START</div>
                </div>
              )}
            </button>

            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">{activeStatus}</p>
              <p className="text-sm text-gray-600">{status}</p>
            </div>
          </div>

          {lastResponse && (
            <div className="mt-6 bg-nhome-primary/5 rounded-lg p-3 border-l-4 border-nhome-primary">
              <h4 className="font-medium text-nhome-primary mb-1">NHome Assistant Update</h4>
              <p className="text-gray-700">{lastResponse}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-left">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Inspector Transcript</h4>
              {userTranscriptSegments.length ? (
                <div className="space-y-2 text-sm text-gray-700">
                  {userTranscriptSegments.map((segment, index) => (
                    <p key={`${segment}-${index}`} className={segment.startsWith('Listening:') ? 'italic text-gray-500' : ''}>
                      {segment}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Awaiting inspector input...</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-left">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Assistant Transcript</h4>
              {assistantMessages.length ? (
                <div className="space-y-2 text-sm text-gray-700">
                  {assistantMessages.map((message, index) => (
                    <p key={`${message}-${index}`}>{message}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Assistant responses will appear here.</p>
              )}
            </div>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => currentItem && openNHomeCamera(currentItem.id)}
            className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:border-nhome-accent transition-all"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-nhome-accent rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z" />
                </svg>
              </div>
              <p className="font-medium text-gray-900">Capture Photo Evidence</p>
              <p className="text-xs text-gray-600">Attach visuals for the current item</p>
            </div>
          </button>

          <button
            onClick={handleToggleAssistant}
            className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-lg hover:border-nhome-secondary transition-all"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-nhome-secondary rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 21H7V3H9V21M17 3H15V21H17V3Z" />
                </svg>
              </div>
              <p className="font-medium text-gray-900">Record Voice Notes</p>
              <p className="text-xs text-gray-600">Use assistant prompts for detailed notes</p>
            </div>
          </button>
        </div>

        {currentItem && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Photos for this item</h3>
            <div className="grid grid-cols-3 gap-3">
              {getNHomePhotosForItem(currentItem.id).map(photo => (
                <div key={photo.id} className="relative border rounded-lg overflow-hidden group">
                  <img src={photo.url} alt={photo.metadata.item} className="w-full h-24 object-cover" />
                  <div className="absolute top-1 left-1 text-[10px] bg-black/50 text-white rounded px-1">
                    {photo.uploaded ? 'Uploaded' : uploadProgress[photo.id] ? `${Math.round(uploadProgress[photo.id])}%` : ''}
                  </div>
                  <button
                    onClick={() => removeNHomePhoto(photo.id)}
                    type="button" className="absolute top-1 right-1 bg-black/60 z-10 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    Remove
                  </button>
                  {!photo.uploaded && (
                    <button
                      onClick={async () => {
                        try {
                          updateUploadProgress(photo.id, 1)
                          const fileName = generateNHomeFileName(photo.metadata)
                          const res = await uploader.uploadNHomeInspectionPhoto(
                            photo.blob,
                            photo.metadata,
                            sessionId,
                            photo.itemId || currentItem.id,
                            fileName,
                            session,
                            (p) => updateUploadProgress(photo.id, p),
                          )
                          if (res.success && res.onedrive_url) {
                            markPhotoUploaded(photo.id, res.onedrive_url)
                          }
                        } catch (e) {
                          console.error('NHome photo upload failed', e)
                          updateUploadProgress(photo.id, 0)
                        }
                      }}
                      type="button" className="absolute bottom-1 right-1 bg-nhome-secondary z-10 hover:opacity-90 text-white text-[10px] px-2 py-1 rounded"
                      title="Upload to OneDrive"
                    >
                      Upload
                    </button>
                  )}
                  <div className="p-2 text-[10px] text-gray-600 truncate" title={generateNHomeFileName(photo.metadata)}>
                    {generateNHomeFileName(photo.metadata)}
                    {photo.uploaded && photo.onedrive_url && (
                      <a
                        href={photo.onedrive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-2 pb-2 -mt-1 text-[10px] text-nhome-primary hover:underline truncate"
                        title={photo.onedrive_url}
                      >
                        {photo.onedrive_url}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <button
                onClick={() => currentItem && openNHomeCamera(currentItem.id)}
                className="text-sm text-nhome-primary hover:underline"
              >
                + Add another photo
              </button>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-nhome-primary/5 to-nhome-secondary/5 rounded-xl p-4 border border-nhome-primary/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-nhome-primary rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-nhome-primary">NHome Professional Excellence</h4>
              <p className="text-sm text-gray-600">
                Maintaining Natalie O'Kelly's standards of excellence for Algarve properties.
                Every assessment contributes to our reputation for thorough, professional service.
              </p>
            </div>
          </div>
        </div>
      </div>
      <NHomeCameraCapture
        isOpen={isCameraOpen}
        onClose={closeNHomeCamera}
        inspectionItem={currentItem ? {
          id: currentItem.id,
          room_type: currentItem.room_type,
          item_description: currentItem.item_description,
          nhome_standard_notes: currentItem.nhome_standard_notes,
        } : undefined}
        sessionData={session ? {
          project_name: session.project?.name,
          apartment_unit: session.apartment?.unit_number,
          apartment_type: session.apartment?.apartment_type,
          inspector_name: 'NHome Inspector',
        } : undefined}
        onPhotoTaken={(blob, url, metadata) => {
          addNHomePhoto(blob, url, metadata)
        }}
      />
    </div>
  )
}


