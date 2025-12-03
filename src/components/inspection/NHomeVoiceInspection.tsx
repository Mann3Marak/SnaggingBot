"use client"
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useState as useLocalState } from 'react'
import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { NHomeLogo } from '@/components/NHomeLogo'
import { useNHomePhotoCapture } from '@/hooks/useNHomePhotoCapture'
import { NHomePhotoUploadService } from '@/services/nhomePhotoUploadService'
import { NHomeCameraCapture } from '@/components/camera/NHomeCameraCapture'
import { SessionHeader } from './SessionHeader'
import { RoomNavigator } from './RoomNavigator'
import { RoomItemList } from './RoomItemList'
import { VoiceWorkspace } from './VoiceWorkspace'
import { MobileRoomSelector } from './MobileRoomSelector'
import { MobileItemSelector } from './MobileItemSelector'
import { StatusLegend } from './StatusLegend'

interface NHomeVoiceInspectionProps {
  sessionId: string
  onRefreshReport?: () => void
}

// Legacy classification retained for reference; no current references.
// type VoiceAssessment = 'good' | 'issue' | 'critical'

type InspectionStatus = 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable'

const STATUS_SEVERITY: Record<InspectionStatus, number> = {
  good: 0,
  issue: 1,
  critical: 2,
  skipped: 0,
  not_applicable: 0,
}

const GOOD_PATTERNS = [
  /\bgood\b/i,
  /\blooks\s+good\b/i,
  /\bin\s+good\s+condition\b/i,
  /\bno\s+issues?\b/i,
  /\bworks?\s+(?:well|fine)\b/i,
  /\bmeets?\s+(?:nhome\s+)?standards?\b/i,
]

const CRITICAL_PATTERNS = [
  /\bcritical\b/i,
  /\bmajor\b/i,
  /\burgent\b/i,
  /\bsevere\b/i,
  /\bbroken\b/i,
  /\bnot\s+working\b/i,
  /\bsafety\b/i,
  /\bstructural\b/i,
  /\brequires?\s+replacement\b/i,
]

const ISSUE_PATTERNS = [
  /\bissue\b/i,
  /\bproblem\b/i,
  /\bdamage(?:d)?\b/i,
  /\bchip\b/i,
  /\bscratch\b/i,
  /\bleak\b/i,
  /\bneeds?\b/i,
  /\brequires?\b/i,
  /\bmissing\b/i,
  /\bnot\s+installed\b/i,
  /\bneeds?\s+attention\b/i,
  /\btouch-?up\b/i,
]

function classifyStatusFromUserInput(text: string): InspectionStatus | null {
  const normalized = text.toLowerCase()
  const trimmed = normalized.trim()
  if (!trimmed) return null

  if (CRITICAL_PATTERNS.some(pattern => pattern.test(text))) {
    return 'critical'
  }

  const explicitlyNegative = /\b(not|isn't|aint|ain't|no)\s+(good|ok|okay|fine)\b/i.test(text)
  if (!explicitlyNegative && GOOD_PATTERNS.some(pattern => pattern.test(text))) {
    return 'good'
  }

  if (ISSUE_PATTERNS.some(pattern => pattern.test(text))) {
    return 'issue'
  }

  // Short descriptive statements like "scratched door" without keywords should still count as issue
  if (trimmed.split(/\s+/).length <= 6 && /\b[a-z]+(?:ed|en|ing)\b/i.test(trimmed)) {
    return 'issue'
  }

  return null
}

function detectStatusFromAgentReply(text: string): InspectionStatus | null {
  const lower = text.toLowerCase()
  if (!lower) return null

  if (CRITICAL_PATTERNS.some(pattern => pattern.test(lower))) {
    return 'critical'
  }
  if (GOOD_PATTERNS.some(pattern => pattern.test(lower))) {
    return 'good'
  }
  if (ISSUE_PATTERNS.some(pattern => pattern.test(lower)) || lower.includes("i've documented")) {
    return 'issue'
  }
  return null
}

function extractDocumentedNotes(reply: string): string[] {
  const matches: string[] = []
  const regex = /I've documented:\s*([\s\S]*?)(?:(?:Please upload|Please provide|Is there anything else|Moving to the next item)[\s\S]*|$)/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(reply)) !== null) {
    const raw = match[1]?.trim() ?? ''
    const cleaned = raw.replace(/^["'\s]+/, '').replace(/["'\s]+$/, '').trim()
    if (cleaned.length) {
      matches.push(cleaned)
    }
  }
  return matches
}

function stripMovingStatement(reply: string): string {
  return reply.replace(/moving to the next item/gi, '').trim()
}

function determinePriority(status: InspectionStatus): number {
  switch (status) {
    case 'critical':
      return 3
    case 'issue':
      return 2
    default:
      return 1
  }
}

export function NHomeVoiceInspection({ sessionId, onRefreshReport }: NHomeVoiceInspectionProps) {
  const {
    session,
    currentItem,
    currentResult,
    nhomeProgress,
    activeRoomId,
    activeItemId,
    roomGroups,
    itemToRoomMap,
    setActiveRoom,
    setActiveItem,
    saveNHomeResult,
    reload
  } = useNHomeInspectionSession(sessionId)
  const currentIndex = session?.current_item_index ?? 0

  const goToNext = async () => {
    if (!session || !session.checklist_items?.length || !currentItem) return;
    const supabase = (await import("@/lib/supabase")).getSupabase();

    // Sort items by order_sequence to ensure correct navigation order
    const sortedItems = [...session.checklist_items].sort(
      (a, b) => (a.order_sequence ?? 0) - (b.order_sequence ?? 0)
    );

    // Find current index based on currentItem.id to avoid desync
    const currentIndex = sortedItems.findIndex((i) => i.id === currentItem.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= sortedItems.length) {
      // End of list — mark as completed
      await supabase
        .from("inspection_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_item_index: nextIndex,
        })
        .eq("id", sessionId);
      return;
    }

    const nextItem = sortedItems[nextIndex];
    if (nextItem) {
      await supabase
        .from("inspection_sessions")
        .update({ current_item_index: nextIndex })
        .eq("id", sessionId);
      setActiveItem(nextItem.id);
    }
  };

  const goToPrevious = async () => {
    if (!session || !session.checklist_items?.length || !currentItem) return;
    const supabase = (await import("@/lib/supabase")).getSupabase();

    // Sort items by order_sequence to ensure correct navigation order
    const sortedItems = [...session.checklist_items].sort(
      (a, b) => (a.order_sequence ?? 0) - (b.order_sequence ?? 0)
    );

    // Find current index based on currentItem.id
    const currentIndex = sortedItems.findIndex((i) => i.id === currentItem.id);
    const prevIndex = Math.max(0, currentIndex - 1);

    const prevItem = sortedItems[prevIndex];
    if (prevItem) {
      await supabase
        .from("inspection_sessions")
        .update({ current_item_index: prevIndex })
        .eq("id", sessionId);
      setActiveItem(prevItem.id);
    }
  };
  const [processing, setProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [pendingStatus, setPendingStatus] = useState<InspectionStatus | null>(null)
  const pendingStatusRef = useRef<InspectionStatus | null>(null)
  const [pendingNotes, setPendingNotes] = useState<string[]>([])
  const pendingNotesRef = useRef<string[]>([])
  const isAutoAdvancingRef = useRef(false)

  useEffect(() => {
    pendingStatusRef.current = pendingStatus
  }, [pendingStatus])

  useEffect(() => {
    pendingNotesRef.current = pendingNotes
  }, [pendingNotes])

  useEffect(() => {
    pendingStatusRef.current = null
    pendingNotesRef.current = []
    isAutoAdvancingRef.current = false
    setPendingStatus(null)
    setPendingNotes([])
  }, [currentItem?.id])

  const updatePendingStatus = useCallback((candidate: InspectionStatus) => {
    setPendingStatus(prev => {
      if (!prev) return candidate
      if (prev === candidate) return prev
      if (candidate === 'good' && prev) {
        return prev
      }
      const currentRank = STATUS_SEVERITY[prev]
      const candidateRank = STATUS_SEVERITY[candidate]
      return candidateRank >= currentRank ? candidate : prev
    })
  }, [])

  const mergeDocumentedNotes = useCallback((notes: string[]) => {
    if (!notes.length) return
    setPendingNotes(prev => {
      const dedup = new Set(prev)
      notes.forEach(note => {
        const cleaned = note.trim()
        if (cleaned.length) {
          dedup.add(cleaned)
        }
      })
      return Array.from(dedup)
    })
  }, [])

  const maybeUpdateStatusFromUserInput = useCallback((text: string) => {
    const status = classifyStatusFromUserInput(text)
    if (status) {
      updatePendingStatus(status)
    }
  }, [updatePendingStatus])

  const finalizeCurrentItem = useCallback(async (agentReply: string) => {
    if (!currentItem || isAutoAdvancingRef.current) return

    const inferredStatus = detectStatusFromAgentReply(agentReply)
    const status: InspectionStatus = pendingStatusRef.current ?? inferredStatus ?? 'good'

    const noteCandidates = pendingNotesRef.current.length
      ? pendingNotesRef.current
      : extractDocumentedNotes(agentReply)

    const uniqueNotes = Array.from(new Set(noteCandidates.map(n => n.trim()).filter(Boolean)))
    let notesToPersist = uniqueNotes.join('\n').trim()

    if (!notesToPersist) {
      const fallback = stripMovingStatement(agentReply)
      notesToPersist = fallback || (
        status === 'good'
          ? `${currentItem.item_description || 'Current item'} noted as good condition`
          : `${currentItem.item_description || 'Current item'} marked as ${status}`
      )
    }

    try {
      isAutoAdvancingRef.current = true
      await saveNHomeResult(
        currentItem.id,
        status,
        notesToPersist,
        determinePriority(status),
        [],
        true
      )
      onRefreshReport?.()
      setPendingStatus(null)
      setPendingNotes([])
    } catch (error) {
      console.error('Auto-advance failed to save NHome result', error)
    } finally {
      isAutoAdvancingRef.current = false
    }
  }, [currentItem, onRefreshReport, saveNHomeResult])

  const handleAgentReply = useCallback(async (reply: string) => {
    if (!reply) return

    const statusFromAgent = detectStatusFromAgentReply(reply)
    if (statusFromAgent) {
      updatePendingStatus(statusFromAgent)
    }

    const documented = extractDocumentedNotes(reply)
    if (documented.length) {
      mergeDocumentedNotes(documented)
    }

    if (/moving to the next item/i.test(reply)) {
      await finalizeCurrentItem(reply)
    }
  }, [finalizeCurrentItem, mergeDocumentedNotes, updatePendingStatus])

  // Realtime voice session removed. Placeholder state for STT/TTS integration.
  const [userTurns, setUserTurns] = useLocalState<string[]>([])
  const [assistantMessages, setAssistantMessages] = useLocalState<string[]>([])
  const [itemConversations, setItemConversations] = useState<Record<string, { role: "user" | "assistant"; content: string }[]>>({});
  const [conversation, setConversation] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isRecording, setIsRecording] = useLocalState(false)
  const status = isRecording ? "Recording..." : "Idle"
  const [liveUserTranscript, setLiveUserTranscript] = useLocalState<string>("")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Local state for notes section when selecting Issue or Critical
  const [showNotes, setShowNotes] = useState<null | { type: 'issue' | 'critical' }>(null)
  const [notesText, setNotesText] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<InspectionStatus | null>(null)

  const [isPlaying, setIsPlaying] = useState(false);

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
        setIsPlaying(true)
        audio.play()
        audio.onended = () => setIsPlaying(false)
      }
    } catch (e) {
      console.error("TTS playback failed", e)
      setIsPlaying(false)
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
        const chunks = [...audioChunksRef.current]
        audioChunksRef.current = []

        if (chunks.length === 0) {
          console.warn('STT skipped: no audio chunks captured')
          return
        }

        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        if (audioBlob.size < 2048) {
          console.warn('STT skipped: audio too short to transcribe')
          return
        }

        const formData = new FormData()
        formData.append('file', audioBlob, 'input.webm')

        try {
          const resp = await fetch('/api/voice/stt', {
            method: 'POST',
            body: formData,
          })
          if (resp.ok) {
            const data = await resp.json()
            const transcript = data.text
            setLiveUserTranscript(transcript)
            setUserTurns(prev => [...prev, transcript])
          } else {
            const errorBody = await resp.json().catch(() => undefined)
            console.error('STT request failed', errorBody)
          }
        } catch (err) {
          console.error('STT error', err)
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
  } = useNHomePhotoCapture(sessionId)
  const uploader = useRef(new NHomePhotoUploadService()).current

  // Responsive breakpoint detection
  const [isMobile, setIsMobile] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    return () => {
      if (isRecording || mediaRecorderRef.current) {
        stopRecording()
      }
    }
  }, [])

  // Helper: Calculate status counts for a room
  const calculateRoomCounts = useCallback((room: any, results: any[]) => {
    const counts = {
      good: 0,
      issue: 0,
      critical: 0,
      skipped: 0,
      notApplicable: 0,
      pending: 0,
    }
    room.items.forEach((item: any) => {
      const result = results?.find((r: any) => r.item_id === item.id)
      if (result) {
        switch (result.status) {
          case 'good':
            counts.good++
            break
          case 'issue':
            counts.issue++
            break
          case 'critical':
            counts.critical++
            break
          case 'skipped':
            counts.skipped++
            break
          case 'not_applicable':
            counts.notApplicable++
            break
        }
      } else {
        counts.pending++
      }
    })
    return counts
  }, [])

  // Helper: Get item status from results
  const getItemStatus = useCallback((itemId: string, results?: any[]) => {
    if (!results) return 'pending'
    const result = results.find((r: any) => r.item_id === itemId)
    return result?.status ?? 'pending'
  }, [])

  // Helper: Jump to next pending item
  const handleJumpToPending = useCallback(() => {
    const activeRoom = roomGroups.find((r: any) => r.roomId === activeRoomId)
    if (!activeRoom) return
    const pendingItem = activeRoom.items.find((item: any) => {
      const result = session?.results?.find((r: any) => r.item_id === item.id)
      return !result || result.status === 'pending'
    })
    if (pendingItem) {
      setActiveItem(pendingItem.id)
    }
  }, [roomGroups, activeRoomId, session, setActiveItem])

  // Transform data for components
  const roomsForNav = useMemo(() => {
    // Sort rooms by the lowest item order_sequence in each room
    const sortedGroups = [...roomGroups].sort((a: any, b: any) => {
      const aMin = Math.min(...(a.items?.map((i: any) => i.order_sequence ?? Infinity) || [Infinity]));
      const bMin = Math.min(...(b.items?.map((i: any) => i.order_sequence ?? Infinity) || [Infinity]));
      return aMin - bMin;
    });

    return sortedGroups.map((group: any) => ({
      roomId: group.roomId,
      label: group.roomLabel,
      counts: calculateRoomCounts(group, session?.results || []),
    }));
  }, [roomGroups, session?.results, calculateRoomCounts]);

  const activeRoom = useMemo(() => {
    return roomGroups.find((r: any) => r.roomId === activeRoomId)
  }, [roomGroups, activeRoomId])

  const itemsForList = useMemo(() => {
    return (
      activeRoom?.items.map((item: any) => ({
        id: item.id,
        label: item.item_description,
        status: getItemStatus(item.id, session?.results),
        order: item.order_sequence,
      })) ?? []
    )
  }, [activeRoom, session?.results, getItemStatus])

  const roomCounts = useMemo(() => {
    return activeRoom
      ? calculateRoomCounts(activeRoom, session?.results || [])
      : {
          good: 0,
          issue: 0,
          critical: 0,
          skipped: 0,
          notApplicable: 0,
          pending: 0,
        }
  }, [activeRoom, session?.results, calculateRoomCounts])

  // Calculate overall status counts for SessionHeader
  const overallCounts = useMemo(() => {
    const counts = {
      good: 0,
      issue: 0,
      critical: 0,
      skipped: 0,
      notApplicable: 0,
      pending: 0,
    }

    // Count all checklist items
    const allItems = session?.checklist_items || []
    const results = session?.results || []

    allItems.forEach((item: any) => {
      const result = results.find((r: any) => r.item_id === item.id)
      if (result) {
        switch (result.status) {
          case 'good':
            counts.good++
            break
          case 'issue':
            counts.issue++
            break
          case 'critical':
            counts.critical++
            break
          case 'skipped':
            counts.skipped++
            break
          case 'not_applicable':
            counts.notApplicable++
            break
        }
      } else {
        counts.pending++
      }
    })

    return counts
  }, [session?.checklist_items, session?.results])

  // Convert results array to Map for MobileItemSelector
  const resultsMap = useMemo(() => {
    const map = new Map()
    const results = session?.results || []
    results.forEach((result: any) => {
      map.set(result.item_id, result)
    })
    return map
  }, [session?.results])

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
    if (userTurns.length === 0 || !currentItem?.id) return;
    const latestTurn = userTurns[userTurns.length - 1];
    maybeUpdateStatusFromUserInput(latestTurn);

    if (!isProcessingTurnRef.current) {
      isProcessingTurnRef.current = true;
      (async () => {
        try {
          const currentItemId = currentItem.id;
          const existingConversation = itemConversations[currentItemId] || [];
          const updatedConversation = [
            ...existingConversation,
            { role: "user" as const, content: latestTurn },
          ];

          const resp = await fetch("/api/nhome/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instructions: inspectionInstructions,
              messages: updatedConversation,
              sessionId,
              currentItem,
              nhomeProgress,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const reply = data.reply || "I heard you.";
            setLastResponse(reply);
            await sendTextMessage(reply, "assistant", true);
            await handleAgentReply(reply);

            const newConversation = [
              ...updatedConversation,
              { role: "assistant" as const, content: reply },
            ];

            // Persist conversation to Supabase (split into user and agent columns)
            const supabase = (await import("@/lib/supabase")).getSupabase();
            const userMessages = newConversation.filter(m => m.role === "user").map(m => m.content);
            const agentMessages = newConversation.filter(m => m.role === "assistant").map(m => m.content);

            await supabase
              .from("inspection_conversations")
              .upsert(
                {
                  session_id: sessionId,
                  item_id: currentItemId,
                  user_messages: userMessages,
                  agent_messages: agentMessages,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "session_id,item_id" }
              );

            setItemConversations((prev) => ({
              ...prev,
              [currentItemId]: newConversation,
            }));

            setConversation(newConversation);
          } else {
            await sendTextMessage("Agent could not process input.", "assistant", true);
          }
        } finally {
          setUserTurns([]);
          isProcessingTurnRef.current = false;
        }
      })();
    }
  }, [handleAgentReply, inspectionInstructions, itemConversations, maybeUpdateStatusFromUserInput, nhomeProgress, currentItem, sessionId, sendTextMessage, userTurns]);


// Load existing conversation and notes when switching items
  useEffect(() => {
    const loadConversationAndNotes = async () => {
      if (!currentItem?.id) return;
      const supabase = (await import("@/lib/supabase")).getSupabase();

      // Load conversation
      const { data: convoData, error: convoError } = await supabase
        .from("inspection_conversations")
        .select("user_messages, agent_messages")
        .eq("session_id", sessionId)
        .eq("item_id", currentItem.id)
        .maybeSingle();

      if (!convoError && convoData) {
        const mergedConversation = [
          ...(convoData.user_messages || []).map((content: string) => ({ role: "user" as const, content })),
          ...(convoData.agent_messages || []).map((content: string) => ({ role: "assistant" as const, content })),
        ];
        setConversation(mergedConversation);
        setItemConversations((prev) => ({
          ...prev,
          [currentItem.id]: mergedConversation,
        }));
      } else {
        setConversation([]);
      }

      // Load existing notes for this item
      const { data: resultData, error: resultError } = await supabase
        .from("inspection_results")
        .select("status, notes")
        .eq("item_id", currentItem.id)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resultError && resultData) {
        setSelectedStatus(resultData.status as InspectionStatus);
        if (resultData.status === "issue" || resultData.status === "critical") {
          setShowNotes({ type: resultData.status });
          setNotesText(resultData.notes || "");
        } else {
          setShowNotes(null);
          setNotesText("");
        }
      } else {
        console.warn("No inspection result found for current item", resultError);
        setShowNotes(null);
        setNotesText("");
        setSelectedStatus(null);
      }
    };

    loadConversationAndNotes();
  }, [currentItem?.id, sessionId]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }
    if (inspectionInstructions) {
      updateSessionInstructions(inspectionInstructions);
    }
  }, [currentItem, inspectionInstructions, isRecording, sendTextMessage, session, updateSessionInstructions]);

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

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading NHome inspection...</div>
        </div>
      </div>
    )
  }

  // Check if inspection is completed
  if (!currentItem && session?.status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] via-white to-[#f3f4f6] text-gray-900">
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
          <div className="inline-flex items-center gap-1.5">
            <span className="font-semibold">Client:</span>
            <span>
              {session.project?.client_name && session.project?.client_surname
                ? `${session.project.client_name} ${session.project.client_surname}`
                : session.project?.client_name ?? "Name and Surname"}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-10 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-nhome-primary mb-3">
              Inspection Complete!
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              All {nhomeProgress.total} items have been inspected for Unit {session.apartment.unit_number}.
            </p>

            <div className="bg-nhome-primary/10 border border-nhome-primary/20 rounded-lg p-6 mb-6 max-w-md mx-auto">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-nhome-primary">{nhomeProgress.completed}</div>
                  <div className="text-sm text-gray-600">Items Checked</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{nhomeProgress.issues_found}</div>
                  <div className="text-sm text-gray-600">Issues Found</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{nhomeProgress.quality_score}/10</div>
                  <div className="text-sm text-gray-600">Quality Score</div>
                </div>
              </div>
            </div>

            {/* Removed "Send professional report to client" section for layout consistency */}
          </div>
        </div>
      </div>
    )
  }

  // If no current item and not completed, still loading
  if (!currentItem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <NHomeLogo variant="primary" size="lg" className="mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading inspection item...</div>
        </div>
      </div>
    )
  }

  // Desktop Layout (≥1024px): Three-column grid with SessionHeader, RoomNavigator, RoomItemList, VoiceWorkspace
  // Mobile Layout (<1024px): Single column with dropdown selectors
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* SessionHeader */}
        <SessionHeader
          projectName={session.project?.name ?? 'NHome Project'}
          apartmentNumber={session.apartment?.unit_number ?? 'N/A'}
          clientName={
            session.apartment?.client_name && session.apartment?.client_surname
              ? `${session.apartment.client_name} ${session.apartment.client_surname}`
              : session.apartment?.client_name || session.apartment?.client_surname || 'No Client Assigned'
          }
          lastUpdated={session.updated_at ?? new Date()}
          counts={overallCounts}
          activeRoomLabel={activeRoom?.roomLabel ?? null}
          activeItemLabel={currentItem?.item_description ?? null}
        />

        {/* Three-column grid layout */}
        <div className="grid grid-cols-[240px_1fr_360px] h-[calc(100vh-80px)]">
          {/* Left Column: RoomNavigator */}
          <div className="border-r border-gray-200 bg-white overflow-y-auto">
            <RoomNavigator
              rooms={roomsForNav}
              activeRoomId={activeRoomId}
              onSelectRoom={setActiveRoom}
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
            />
          </div>

          {/* Middle Column: RoomItemList */}
          <div className="bg-gray-50 overflow-y-auto">
            <RoomItemList
              roomName={activeRoom?.roomLabel ?? 'Select a room'}
              items={itemsForList}
              activeItemId={activeItemId}
              onSelectItem={setActiveItem}
              counts={roomCounts}
              onJumpNextPending={handleJumpToPending}
            />
          </div>

          {/* Right Column: VoiceWorkspace */}
          <div className="border-l border-gray-200 bg-white overflow-y-auto">
            <VoiceWorkspace
              currentItem={currentItem}
              currentResult={currentResult}
              isRecording={isRecording}
              isPlaying={isPlaying}
              status={status}
              activeStatus={activeStatus}
              userTranscriptSegments={userTranscriptSegments}
              assistantMessages={assistantMessages}
              lastResponse={lastResponse}
              onToggleRecording={handleToggleAssistant}
              onCapturePhoto={() => currentItem && openNHomeCamera(currentItem.id)}
              onNavigatePrevious={goToPrevious}
              onNavigateNext={goToNext}
              photos={currentItem ? getNHomePhotosForItem(currentItem.id) : []}
              uploadProgress={uploadProgress}
              onRemovePhoto={removeNHomePhoto}
              onUploadPhoto={async (photoId: string, photoBlob: Blob, metadata: any) => {
                try {
                  updateUploadProgress(photoId, 1)
                  const fileName = generateNHomeFileName(metadata)
                  const res = await uploader.uploadNHomeInspectionPhoto(
                    photoBlob,
                    metadata,
                    sessionId,
                    metadata.itemId || currentItem?.id,
                    fileName,
                    session,
                    (p) => updateUploadProgress(photoId, p)
                  )
                  if (res.success && res.supabase_url) {
                    markPhotoUploaded(photoId, res.supabase_url, res.photo)
                  }
                } catch (e) {
                  console.error('Photo upload failed', e)
                  updateUploadProgress(photoId, 0)
                }
              }}
              generatePhotoFileName={generateNHomeFileName}
              sessionId={sessionId}
              session={session}
            />

            {/* Manual Status Buttons */}
            <div className="p-4 border-t border-gray-200 bg-white space-y-3">
              {/* First row: Good, Issue, Critical */}
              <div className="flex justify-center gap-3">
                {(['good', 'issue', 'critical'] as const).map((status) => {
                  const isSelected = selectedStatus === status;
                  const label =
                    status === 'good'
                      ? '✓ Good'
                      : status === 'issue'
                      ? '⚠ Issue'
                      : '✗ Critical';
                  const colorClasses = isSelected
                    ? status === 'good'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : status === 'issue'
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                    : status === 'good'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : status === 'issue'
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200';
                  return (
                    <button
                      key={status}
                      onClick={async () => {
                        if (!currentItem) return;
                        const newStatus = isSelected ? null : status;

                        if (newStatus === 'issue' || newStatus === 'critical') {
                          setShowNotes({ type: newStatus });
                          setSelectedStatus(newStatus);
                          return;
                        }

                        if (newStatus) {
                          await saveNHomeResult(
                            currentItem.id,
                            newStatus,
                            `${currentItem.item_description || 'Item'} marked as ${newStatus}`,
                            determinePriority(newStatus as any),
                            [],
                            true
                          );
                          setSelectedStatus(newStatus);
                          await reload();
                        } else {
                          const supabase = (await import("@/lib/supabase")).getSupabase();
                          await supabase
                            .from("inspection_results")
                            .update({ status: "pending" })
                            .eq("item_id", currentItem.id)
                            .eq("session_id", sessionId);
                          setSelectedStatus(null);
                          setShowNotes(null);
                          await reload();
                        }
                      }}
                      className={`px-4 py-2 rounded-full font-semibold shadow-sm transition ${colorClasses}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Notes Section for Issue/Critical */}
              {showNotes && (
                <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    {showNotes.type === 'issue' ? 'Describe the issue:' : 'Describe the critical problem:'}
                  </h3>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Enter detailed notes here..."
                    className="w-full p-2 border rounded-md text-gray-800 focus:ring-2 focus:ring-nhome-primary focus:outline-none"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => {
                        setShowNotes(null);
                        setNotesText('');
                        setSelectedStatus(null);
                      }}
                      className="px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!notesText.trim()}
                      onClick={async () => {
                        if (!currentItem || !notesText.trim()) return;
                        await saveNHomeResult(
                          currentItem.id,
                          showNotes.type,
                          notesText.trim(),
                          determinePriority(showNotes.type),
                          [],
                          true
                        );
                        setShowNotes(null);
                        setNotesText('');
                        setSelectedStatus(showNotes.type);
                        await reload();
                      }}
                      className={`px-4 py-2 rounded-md font-semibold transition ${
                        notesText.trim()
                          ? 'bg-nhome-primary text-white hover:bg-nhome-secondary'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              )}

              {/* Second row: Skipped, Not Applicable */}
              <div className="flex justify-center gap-3">
                {(['skipped', 'not_applicable'] as const).map((status) => {
                  const isSelected = selectedStatus === status;
                  const label =
                    status === 'skipped' ? '⏭ Skipped' : '🚫 Not Applicable';
                  const colorClasses = isSelected
                    ? status === 'skipped'
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    : status === 'skipped'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200';
                  return (
                    <button
                      key={status}
                      onClick={async () => {
                        if (!currentItem) return;
                        const newStatus = isSelected ? null : status;
                        if (newStatus) {
                          await saveNHomeResult(
                            currentItem.id,
                            newStatus,
                            `${currentItem.item_description || 'Item'} marked as ${newStatus}`,
                            determinePriority(newStatus as any),
                            [],
                            true
                          );
                          setSelectedStatus(newStatus);
                          await reload();
                        } else {
                          const supabase = (await import("@/lib/supabase")).getSupabase();
                          await supabase
                            .from("inspection_results")
                            .update({ status: "pending" })
                            .eq("item_id", currentItem.id)
                            .eq("session_id", sessionId);
                          setSelectedStatus(null);
                          await reload();
                        }
                      }}
                      className={`px-4 py-2 rounded-full font-semibold shadow-sm transition ${colorClasses}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Status Legend - Fixed at bottom */}
        <div className="fixed bottom-4 right-4 max-w-md">
          <StatusLegend compact />
        </div>

        {/* Camera Modal */}
        <NHomeCameraCapture
          isOpen={isCameraOpen}
          onClose={closeNHomeCamera}
          inspectionItem={
            currentItem
              ? {
                  id: currentItem.id,
                  room_type: currentItem.room_type,
                  item_description: currentItem.item_description,
                  nhome_standard_notes: currentItem.nhome_standard_notes ?? undefined,
                }
              : undefined
          }
          sessionData={
            session
              ? {
                  project_name: session.project?.name,
                  apartment_unit: session.apartment?.unit_number,
                  apartment_type: session.apartment?.apartment_type,
                  inspector_name: 'NHome Inspector',
                }
              : undefined
          }
          onPhotoTaken={async (blob, url, metadata) => {
            // Add photo locally first and get its ID
            const newPhoto = addNHomePhoto(blob, url, metadata);
            const photoId = typeof newPhoto === "string" ? newPhoto : newPhoto.id;

            try {
              updateUploadProgress(photoId, 1);
              const fileName = generateNHomeFileName(metadata);
              const res = await uploader.uploadNHomeInspectionPhoto(
                blob,
                metadata,
                sessionId,
                (metadata as any).item || currentItem?.id,
                fileName,
                session,
                (p) => updateUploadProgress(photoId, p)
              );
              if (res.success && res.supabase_url) {
                markPhotoUploaded(photoId, res.supabase_url, res.photo?.id || "");
              }
            } catch (e) {
              console.error("Auto-upload failed", e);
              updateUploadProgress(photoId, 0);
            }
          }}
        />
      </div>
    )
  }

  // Mobile Layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* SessionHeader */}
      <SessionHeader
        projectName={session.project?.name ?? 'NHome Project'}
        apartmentNumber={session.apartment?.unit_number ?? 'N/A'}
        clientName={
          session.apartment?.client_name && session.apartment?.client_surname
            ? `${session.apartment.client_name} ${session.apartment.client_surname}`
            : session.apartment?.client_name || session.apartment?.client_surname || 'No Client Assigned'
        }
        lastUpdated={session.updated_at ?? new Date()}
        counts={overallCounts}
        activeRoomLabel={activeRoom?.roomLabel ?? null}
        activeItemLabel={currentItem?.item_description ?? null}
      />

      {/* Mobile Selectors */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3">
        <MobileRoomSelector
          rooms={roomGroups
            .slice()
            .sort((a: any, b: any) => {
              const aMin = Math.min(...(a.items?.map((i: any) => i.order_sequence ?? Infinity) || [Infinity]));
              const bMin = Math.min(...(b.items?.map((i: any) => i.order_sequence ?? Infinity) || [Infinity]));
              return aMin - bMin;
            })}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoom}
        />
        <MobileItemSelector
          items={activeRoom?.items ?? []}
          activeItemId={activeItemId}
          onSelectItem={setActiveItem}
          results={resultsMap}
        />
      </div>

      {/* VoiceWorkspace */}
      <div className="bg-white">
        {(() => {
          const items = activeRoom?.items ?? [];
          const currentIndex = items.findIndex((i: any) => i.id === currentItem?.id);
          const nextItem = currentIndex >= 0 && currentIndex + 1 < items.length ? items[currentIndex + 1] : currentItem;

          return (
            <VoiceWorkspace
              currentItem={nextItem}
              currentResult={currentResult}
              isRecording={isRecording}
              isPlaying={isPlaying}
              status={status}
              activeStatus={activeStatus}
              userTranscriptSegments={userTranscriptSegments}
              assistantMessages={assistantMessages}
              lastResponse={lastResponse}
              onToggleRecording={handleToggleAssistant}
              onCapturePhoto={() => currentItem && openNHomeCamera(currentItem.id)}
              onNavigatePrevious={goToPrevious}
              onNavigateNext={goToNext}
              photos={currentItem ? getNHomePhotosForItem(currentItem.id) : []}
              uploadProgress={uploadProgress}
              onRemovePhoto={removeNHomePhoto}
              onUploadPhoto={async (photoId: string, photoBlob: Blob, metadata: any) => {
                try {
                  updateUploadProgress(photoId, 1);
                  const fileName = generateNHomeFileName(metadata);
                  const res = await uploader.uploadNHomeInspectionPhoto(
                    photoBlob,
                    metadata,
                    sessionId,
                    metadata.itemId || currentItem?.id,
                    fileName,
                    session,
                    (p) => updateUploadProgress(photoId, p)
                  );
                  if (res.success && res.supabase_url) {
                    markPhotoUploaded(photoId, res.supabase_url, res.photo);
                  }
                } catch (e) {
                  console.error("Photo upload failed", e);
                  updateUploadProgress(photoId, 0);
                }
              }}
              generatePhotoFileName={generateNHomeFileName}
              sessionId={sessionId}
              session={session}
            />
          );
        })()}
      </div>

      {/* Manual Status Buttons for Mobile */}
      <div className="p-4 border-t border-gray-200 bg-white space-y-3">
        {/* First row: Good, Issue, Critical */}
        <div className="flex justify-center gap-3">
          {(['good', 'issue', 'critical'] as const).map((status) => {
            const isSelected = selectedStatus === status;
            const label =
              status === 'good'
                ? '✓ Good'
                : status === 'issue'
                ? '⚠ Issue'
                : '✗ Critical';
            const colorClasses = isSelected
              ? status === 'good'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : status === 'issue'
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-red-600 text-white hover:bg-red-700'
              : status === 'good'
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : status === 'issue'
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200';
            return (
              <button
                key={status}
                onClick={async () => {
                  if (!currentItem) return;
                  const newStatus = isSelected ? null : status;

                  if (newStatus === 'issue' || newStatus === 'critical') {
                    setShowNotes({ type: newStatus });
                    setSelectedStatus(newStatus);
                    return;
                  }

                  if (newStatus) {
                    await saveNHomeResult(
                      currentItem.id,
                      newStatus,
                      `${currentItem.item_description || 'Item'} marked as ${newStatus}`,
                      determinePriority(newStatus as any),
                      [],
                      true
                    );
                    setSelectedStatus(newStatus);
                    await reload();
                  } else {
                    const supabase = (await import("@/lib/supabase")).getSupabase();
                    await supabase
                      .from("inspection_results")
                      .update({ status: "pending" })
                      .eq("item_id", currentItem.id)
                      .eq("session_id", sessionId);
                    setSelectedStatus(null);
                    setShowNotes(null);
                    await reload();
                  }
                }}
                className={`px-4 py-2 rounded-full font-semibold shadow-sm transition ${colorClasses}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Notes Section for Issue/Critical */}
        {showNotes && (
          <div className="mt-4 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-semibold text-gray-800 mb-2">
              {showNotes.type === 'issue' ? 'Describe the issue:' : 'Describe the critical problem:'}
            </h3>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Enter detailed notes here..."
              className="w-full p-2 border rounded-md text-gray-800 focus:ring-2 focus:ring-nhome-primary focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setShowNotes(null);
                  setNotesText('');
                  setSelectedStatus(null);
                }}
                className="px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                disabled={!notesText.trim()}
                onClick={async () => {
                  if (!currentItem || !notesText.trim()) return;
                  await saveNHomeResult(
                    currentItem.id,
                    showNotes.type,
                    notesText.trim(),
                    determinePriority(showNotes.type),
                    [],
                    true
                  );
                  setShowNotes(null);
                  setNotesText('');
                  setSelectedStatus(showNotes.type);
                  await reload();
                }}
                className={`px-4 py-2 rounded-md font-semibold transition ${
                  notesText.trim()
                    ? 'bg-nhome-primary text-white hover:bg-nhome-secondary'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save Notes
              </button>
            </div>
          </div>
        )}

        {/* Second row: Skipped, Not Applicable */}
        <div className="flex justify-center gap-3">
          {(['skipped', 'not_applicable'] as const).map((status) => {
            const isSelected = selectedStatus === status;
            const label =
              status === 'skipped' ? '⏭ Skipped' : '🚫 Not Applicable';
            const colorClasses = isSelected
              ? status === 'skipped'
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              : status === 'skipped'
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200';
            return (
              <button
                key={status}
                onClick={async () => {
                  if (!currentItem) return;
                  const newStatus = isSelected ? null : status;
                  if (newStatus) {
                    await saveNHomeResult(
                      currentItem.id,
                      newStatus,
                      `${currentItem.item_description || 'Item'} marked as ${newStatus}`,
                      determinePriority(newStatus as any),
                      [],
                      true
                    );
                    setSelectedStatus(newStatus);
                    await reload();
                  } else {
                    const supabase = (await import("@/lib/supabase")).getSupabase();
                    await supabase
                      .from("inspection_results")
                      .update({ status: "pending" })
                      .eq("item_id", currentItem.id)
                      .eq("session_id", sessionId);
                    setSelectedStatus(null);
                    await reload();
                  }
                }}
                className={`px-4 py-2 rounded-full font-semibold shadow-sm transition ${colorClasses}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Legend - Compact horizontal */}
      <div className="bg-white border-t border-gray-200 p-4">
        <StatusLegend compact />
      </div>

      {/* Camera Modal */}
      <NHomeCameraCapture
        isOpen={isCameraOpen}
        onClose={closeNHomeCamera}
        inspectionItem={
          currentItem
            ? {
                id: currentItem.id,
                room_type: currentItem.room_type,
                item_description: currentItem.item_description,
                nhome_standard_notes: currentItem.nhome_standard_notes ?? undefined,
              }
            : undefined
        }
        sessionData={
          session
            ? {
                project_name: session.project?.name,
                apartment_unit: session.apartment?.unit_number,
                apartment_type: session.apartment?.apartment_type,
                inspector_name: 'NHome Inspector',
              }
            : undefined
        }
        onPhotoTaken={async (blob, url, metadata) => {
          // Add photo locally first and get its ID
          const newPhoto = addNHomePhoto(blob, url, metadata);
          const photoId = typeof newPhoto === "string" ? newPhoto : newPhoto.id;

          try {
            updateUploadProgress(photoId, 1);
            const fileName = generateNHomeFileName(metadata);
            const res = await uploader.uploadNHomeInspectionPhoto(
              blob,
              metadata,
              sessionId,
              (metadata as any).item || currentItem?.id,
              fileName,
              session,
              (p) => updateUploadProgress(photoId, p)
            );
            if (res.success && res.supabase_url) {
              markPhotoUploaded(photoId, res.supabase_url, res.photo?.id || "");
            }
          } catch (e) {
            console.error("Auto-upload failed", e);
            updateUploadProgress(photoId, 0);
          }
        }}
      />
    </div>
  )
}
