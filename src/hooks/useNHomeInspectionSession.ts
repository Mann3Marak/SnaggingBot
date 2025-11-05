"use client"
import { useEffect, useState, useMemo } from 'react'
import { getSupabase } from '@/lib/supabase'

// ==================== TYPE DEFINITIONS ====================

export interface ChecklistItem {
  id: string
  apartment_type: string
  room_type: string
  item_description: string
  item_description_pt?: string | null
  order_sequence: number
  nhome_standard_notes?: string | null
  created_at: string
}

export interface RoomGroup {
  roomId: string // slugged room name for unique identification
  roomLabel: string // display name
  items: ChecklistItem[]
}

export interface InspectionSession {
  id: string
  apartment_id: string
  inspector_id: string
  status: string
  current_item_index: number
  active_item_id: string | null
  nhome_quality_score?: number | null
  completed_at?: string | null
  created_at: string
  updated_at: string
  apartments?: any // Keep existing relationship type
  apartment?: any
  project?: any
  checklist_items: ChecklistItem[]
  results: any[]
  roomGroups: RoomGroup[]
}

export interface NHomeProgress {
  completed: number // Total results saved
  total: number // Total checklist items
  good: number // Items marked as good
  issue: number // Items with issues
  critical: number // Critical items
  skipped: number // Items skipped for later
  notApplicable: number // Items not applicable
  pending: number // Items not yet inspected
  quality_score: number // Calculated quality score (1-10)
  // Legacy field for backward compatibility
  issues_found: number // Same as 'issue' count
}

export interface InspectionResult {
  id: string
  session_id: string
  item_id: string
  status: 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable'
  notes?: string | null
  priority_level?: number | null
  photo_urls?: string[] | null
  created_at: string
  updated_at?: string
}

export interface UseNHomeInspectionSessionReturn {
  session: InspectionSession | null
  currentItem: ChecklistItem | null
  currentResult: InspectionResult | null
  loading: boolean
  nhomeProgress: NHomeProgress
  activeRoomId: string | null
  activeItemId: string | null
  roomGroups: RoomGroup[]
  itemToRoomMap: Map<string, string>
  setActiveRoom: (roomId: string) => Promise<void>
  setActiveItem: (itemId: string) => Promise<void>
  saveNHomeResult: (
    itemId: string,
    status: 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable',
    notes?: string,
    priority?: number,
    photos?: string[],
    shouldAdvance?: boolean
  ) => Promise<void>
  reload: () => Promise<void>
}

// ==================== UTILITY FUNCTIONS ====================

function slugifyRoomType(roomType: string): string {
  return roomType.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function groupChecklistByRoom(checklist: ChecklistItem[]): RoomGroup[] {
  const roomMap = new Map<string, ChecklistItem[]>()

  for (const item of checklist) {
    const roomId = slugifyRoomType(item.room_type)
    if (!roomMap.has(roomId)) {
      roomMap.set(roomId, [])
    }
    roomMap.get(roomId)!.push(item)
  }

  const groups: RoomGroup[] = []
  for (const [roomId, items] of roomMap.entries()) {
    groups.push({
      roomId,
      roomLabel: items[0].room_type, // Use original room_type as label
      items
    })
  }

  return groups
}

// ==================== HOOK IMPLEMENTATION ====================

export function useNHomeInspectionSession(sessionId: string): UseNHomeInspectionSessionReturn {
  const [session, setSession] = useState<InspectionSession | null>(null)
  const [currentItem, setCurrentItem] = useState<ChecklistItem | null>(null)
  const [currentResult, setCurrentResult] = useState<InspectionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [nhomeProgress, setNHomeProgress] = useState<NHomeProgress>({
    completed: 0,
    total: 0,
    good: 0,
    issue: 0,
    critical: 0,
    skipped: 0,
    notApplicable: 0,
    pending: 0,
    quality_score: 0,
    issues_found: 0,
  })
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([])

  useEffect(()=>{ load() },[sessionId])

  async function load(){
    setLoading(true)
    try{
      console.info('[NHomeSession] Loading session', { sessionId })
      const supabase = getSupabase()
      const { data: sessionData, error: sessionError } = await supabase
        .from('inspection_sessions')
        .select('*, apartments:apartment_id (*, projects (*))')
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('[NHomeSession] Failed to load inspection session', {
          sessionId,
          error: sessionError.message,
          code: sessionError.code,
        })
      } else {
        console.info('[NHomeSession] Session row received', {
          sessionId,
          hasApartment: Boolean(sessionData?.apartments),
          hasProject: Boolean(sessionData?.apartments?.projects),
        })
      }

      if (!sessionData) {
        console.warn('[NHomeSession] No session found', { sessionId })
        setSession(null)
        setCurrentItem(null)
        setNHomeProgress({
          completed: 0,
          total: 0,
          good: 0,
          issue: 0,
          critical: 0,
          skipped: 0,
          notApplicable: 0,
          pending: 0,
          quality_score: 0,
          issues_found: 0,
        })
        return
      }

      if (!sessionData.apartments || !sessionData.apartments?.projects) {
        console.warn('[NHomeSession] Session is missing apartment/project relationships', {
          sessionId,
          hasApartment: Boolean(sessionData.apartments),
          hasProject: Boolean(sessionData.apartments?.projects),
        })
        try {
          const diagResponse = await fetch(`/api/nhome/diagnostics/${sessionId}`, { cache: 'no-store' })
          const diagPayload = await diagResponse.json()
          console.info('[NHomeSession] Diagnostics snapshot', {
            status: diagResponse.status,
            note: diagPayload?.note,
            sessionInspector: diagPayload?.session?.inspector_id,
            checklistCount: diagPayload?.resultsCount,
            photoCount: diagPayload?.photosCount,
          })
        } catch (diagError) {
          console.error('[NHomeSession] Diagnostics fetch failed', diagError)
        }
      }

      const { data: checklist, error: checklistError } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('apartment_type', sessionData?.apartments?.apartment_type)
        .order('room_type')
        .order('order_sequence');

      if (checklistError) {
        console.warn("[NHomeSession] Error loading checklist templates", {
          sessionId,
          apartmentType: sessionData?.apartments?.apartment_type,
          error: checklistError.message,
          code: checklistError.code,
        });
      }

      if (!checklist || checklist.length === 0) {
        console.warn(
          `[NHomeSession] No checklist templates found for apartment type`,
          { sessionId, apartmentType: sessionData?.apartments?.apartment_type }
        );
      }

      const { data: results, error: resultsError } = await supabase
        .from('inspection_results')
        .select('*', { head: false })
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .throwOnError()

      if (resultsError) {
        console.error('[NHomeSession] Error loading inspection results', {
          sessionId,
          error: resultsError.message,
          code: resultsError.code,
        })
      }

      // Transform checklist into room groups
      const groups = groupChecklistByRoom(checklist ?? [])
      setRoomGroups(groups)

      // Build enhanced session with room groups
      const enhanced: InspectionSession = {
        ...sessionData,
        checklist_items: checklist ?? [],
        results: results ?? [],
        apartment: sessionData?.apartments,
        project: sessionData?.apartments?.projects,
        roomGroups: groups
      }
      // Force new object reference to trigger re-render in dependent components
      setSession({ ...enhanced })

      // Calculate progress with detailed status counts
      const resultsList = results ?? []
      const completed = resultsList.length
      const total = checklist?.length ?? 0

      const good = resultsList.filter((r: InspectionResult) => r.status === 'good').length
      const issue = resultsList.filter((r: InspectionResult) => r.status === 'issue').length
      const critical = resultsList.filter((r: InspectionResult) => r.status === 'critical').length
      const skipped = resultsList.filter((r: InspectionResult) => r.status === 'skipped').length
      const notApplicable = resultsList.filter((r: InspectionResult) => r.status === 'not_applicable').length
      const pending = total - completed

      const quality_score = calculateScore(resultsList)

      setNHomeProgress({
        completed,
        total,
        good,
        issue,
        critical,
        skipped,
        notApplicable,
        pending,
        quality_score,
        issues_found: issue, // Legacy field
      })

      // Determine active item - prioritize active_item_id, fallback to current_item_index
      let activeItem: ChecklistItem | null = null
      let activeId: string | null = null
      let activeRoom: string | null = null

      if (sessionData?.active_item_id && checklist) {
        // Use active_item_id if present
        activeItem = checklist.find((item: ChecklistItem) => item.id === sessionData.active_item_id) ?? null
        if (activeItem) {
          activeId = activeItem.id
          activeRoom = slugifyRoomType(activeItem.room_type)
          console.info('[NHomeSession] Using active_item_id', {
            activeItemId: activeId,
            activeRoomId: activeRoom,
          })
        }
      }

      if (!activeItem && checklist && checklist.length > 0) {
        // Fallback to current_item_index
        const idx = sessionData?.current_item_index ?? 0
        activeItem = checklist[idx] ?? null
        if (activeItem) {
          activeId = activeItem.id
          activeRoom = slugifyRoomType(activeItem.room_type)
          console.info('[NHomeSession] Fallback to current_item_index', {
            currentIndex: idx,
            activeItemId: activeId,
            activeRoomId: activeRoom,
          })
        }
      }

      setCurrentItem(activeItem)
      setActiveItemId(activeId)
      setActiveRoomId(activeRoom)

      // Find the inspection result for the active item
      const result = activeId ? (results ?? []).find((r: InspectionResult) => r.item_id === activeId) ?? null : null
      setCurrentResult(result)

      console.info('[NHomeSession] Load complete', {
        sessionId,
        checklistItems: total,
        resultsCount: completed,
        roomGroupsCount: groups.length,
        activeItemId: activeId,
        activeRoomId: activeRoom,
        hasResult: Boolean(result),
        quality_score,
      })
    }catch(e){ console.error('Error loading NHome session', e) } finally{ setLoading(false) }
  }

  /**
   * Calculate quality score (1-10 scale)
   *
   * Quality Score Logic:
   * - Only counts 'good', 'issue', and 'critical' results (excludes 'skipped' and 'not_applicable')
   * - Base score: (good / inspected) * 10
   * - Each 'issue' reduces the base proportionally
   * - Each 'critical' applies an additional -2 point penalty
   * - Minimum score is 1 (never 0)
   *
   * Examples:
   * - 10 good, 0 issue, 0 critical = 10.0
   * - 8 good, 2 issue, 0 critical = 8.0
   * - 8 good, 0 issue, 2 critical = 6.0 (10 - 4 penalty)
   * - 5 good, 3 issue, 2 critical = 2.5 (6.25 - 4 penalty = 2.25, rounded to 2.5)
   */
  function calculateScore(results: InspectionResult[]): number {
    // Only count results that represent actual inspection outcomes
    const inspectedResults = results.filter(
      r => r.status === 'good' || r.status === 'issue' || r.status === 'critical'
    )

    if (inspectedResults.length === 0) return 0

    const total = inspectedResults.length
    const good = inspectedResults.filter(r => r.status === 'good').length
    const issue = inspectedResults.filter(r => r.status === 'issue').length
    const critical = inspectedResults.filter(r => r.status === 'critical').length

    // Base score from good/total ratio (0-10)
    const base = (good / total) * 10

    // Critical items have double penalty (2 points each)
    const penalty = critical * 2

    // Apply penalty and ensure minimum score of 1
    return Math.max(1, Math.round((base - penalty) * 10) / 10)
  }

  // ==================== ACTIVE ITEM/ROOM SETTERS ====================

  async function setActiveRoom(roomId: string): Promise<void> {
    console.info('[NHomeSession] Setting active room', { sessionId, roomId })

    // Find the room group
    const group = roomGroups.find(g => g.roomId === roomId)
    if (!group || group.items.length === 0) {
      console.warn('[NHomeSession] Room not found or has no items', { roomId })
      return
    }

    // Set first item of the room as active
    const firstItem = group.items[0]
    await setActiveItem(firstItem.id)
  }

  async function setActiveItem(itemId: string): Promise<void> {
    console.info('[NHomeSession] Setting active item', { sessionId, itemId })

    const supabase = getSupabase()

    // Find the item in checklist
    const item = session?.checklist_items?.find((i: ChecklistItem) => i.id === itemId)
    if (!item) {
      console.warn('[NHomeSession] Item not found in checklist', { itemId })
      return
    }

    // Update session with new active_item_id
    const { error: updateError } = await supabase
      .from('inspection_sessions')
      .update({ active_item_id: itemId })
      .eq('id', sessionId)

    if (updateError) {
      console.error('[NHomeSession] Failed to update active_item_id', {
        sessionId,
        itemId,
        error: updateError.message,
        code: updateError.code,
      })
      throw updateError
    }

    // Update local state
    const newRoomId = slugifyRoomType(item.room_type)
    setCurrentItem(item)
    setActiveItemId(itemId)
    setActiveRoomId(newRoomId)

    // Update current result
    const result = session?.results?.find((r: InspectionResult) => r.item_id === itemId) ?? null
    setCurrentResult(result)

    console.info('[NHomeSession] Active item updated', {
      sessionId,
      itemId,
      roomId: newRoomId,
      hasResult: Boolean(result),
    })
  }

  // ==================== SAVE RESULT ====================

  async function saveNHomeResult(
    itemId: string,
    status: 'good' | 'issue' | 'critical' | 'skipped' | 'not_applicable',
    notes?: string,
    priority: number = 1,
    photos: string[] = [],
    shouldAdvance: boolean = false
  ) {
    const supabase = getSupabase()
    // Upsert the inspection result incrementally
    console.info('[NHomeSession] Saving result', {
      sessionId,
      itemId,
      status,
      hasNotes: Boolean(notes),
      photoCount: photos.length,
      shouldAdvance,
    })
    const payload: any = {
      session_id: sessionId,
      item_id: itemId,
      status,
      priority_level: priority,
      photo_urls: photos.length > 0 ? photos : undefined,
      created_at: new Date().toISOString(),
    }

    // Include notes for non-good statuses (optional for all statuses)
    // Notes are particularly useful for 'issue', 'critical', 'skipped', and 'not_applicable'
    if (notes && notes.trim().length > 0) {
      payload.notes = notes
    }

    const { error: upsertError } = await supabase.from('inspection_results').upsert(payload);
    if (upsertError) {
      console.error('[NHomeSession] Failed to upsert inspection result', {
        sessionId,
        itemId,
        error: upsertError.message,
        code: upsertError.code,
      });
      throw upsertError;
    }

    // Immediately re-fetch updated results to ensure latest data is loaded
    const { data: refreshedResults, error: refreshError } = await supabase
      .from('inspection_results')
      .select('*', { head: false })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .throwOnError();

    if (refreshError) {
      console.warn('[NHomeSession] Warning: could not refresh results after save', refreshError);
    } else {
      console.info('[NHomeSession] Refreshed results after save', { count: refreshedResults?.length });
    }

    // Update session progress incrementally
    const totalItems = session?.checklist_items?.length ?? 0
    const rawScore = Number(nhomeProgress.quality_score || 0)
    const clamped = Math.max(1, Math.min(10, rawScore))
    const safeScoreInt = Math.round(clamped)
    const updates: any = {
      nhome_quality_score: safeScoreInt,
      active_item_id: itemId, // Always update active_item_id to the item being saved
    }

    // Only advance to next item if explicitly requested
    if (shouldAdvance) {
      const nextIndex = (session?.current_item_index ?? 0) + 1
      updates.current_item_index = nextIndex

      // Update active_item_id to next item if advancing
      const nextItem = session?.checklist_items?.[nextIndex]
      if (nextItem) {
        updates.active_item_id = nextItem.id
      }

      // Check if we've completed all items
      // totalItems is the count, but items are 0-indexed, so valid indexes are 0 to (totalItems-1)
      // When nextIndex equals totalItems, we've gone past the last item
      if (totalItems > 0 && nextIndex >= totalItems) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
        updates.active_item_id = null // Clear active_item_id when inspection is completed
        console.info('[NHomeSession] Inspection completed!', {
          sessionId,
          totalItems,
          finalIndex: nextIndex,
        })
      }
    }

    const { error: updateError } = await supabase.from('inspection_sessions').update(updates).eq('id', sessionId)
    if (updateError) {
      console.error('[NHomeSession] Failed to update session progress', {
        sessionId,
        updates,
        error: updateError.message,
        code: updateError.code,
      })
      throw updateError
    }

    console.info('[NHomeSession] Result saved, refreshing session', {
      sessionId,
      updates,
    })
    await load()
  }

  // ==================== MEMOIZED LOOKUP MAP ====================

  const itemToRoomMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const group of roomGroups) {
      for (const item of group.items) {
        map.set(item.id, group.roomId)
      }
    }
    console.info('[NHomeSession] Item-to-room map built', {
      sessionId,
      mappedItems: map.size,
      roomCount: roomGroups.length,
    })
    return map
  }, [roomGroups, sessionId])

  // ==================== HOOK RETURN ====================

  return {
    session,
    currentItem,
    currentResult,
    loading,
    nhomeProgress,
    activeRoomId,
    activeItemId,
    roomGroups,
    itemToRoomMap,
    setActiveRoom,
    setActiveItem,
    saveNHomeResult,
    reload: load,
  }
}
