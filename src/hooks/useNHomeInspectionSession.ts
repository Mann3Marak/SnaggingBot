"use client"
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export function useNHomeInspectionSession(sessionId: string){
  const [session, setSession] = useState<any>(null)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nhomeProgress, setNHomeProgress] = useState({ completed: 0, total: 0, issues_found: 0, quality_score: 0 })

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
        setNHomeProgress({ completed: 0, total: 0, issues_found: 0, quality_score: 0 })
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
        .select('*')
        .eq('session_id', sessionId)

      if (resultsError) {
        console.error('[NHomeSession] Error loading inspection results', {
          sessionId,
          error: resultsError.message,
          code: resultsError.code,
        })
      }

      const enhanced = { ...sessionData, checklist_items: checklist ?? [], results: results ?? [], apartment: sessionData?.apartments, project: sessionData?.apartments?.projects }
      setSession(enhanced)

      const completed = results?.length ?? 0
      const total = checklist?.length ?? 0
      const issues_found = (results ?? []).filter((r:any)=>r.status==='issue').length
      const quality_score = calculateScore(results ?? [])
      setNHomeProgress({ completed, total, issues_found, quality_score })

      const idx = sessionData?.current_item_index ?? 0
      setCurrentItem(checklist?.[idx])
      console.info('[NHomeSession] Load complete', {
        sessionId,
        checklistItems: total,
        resultsCount: completed,
        currentIndex: idx,
        quality_score,
      })
    }catch(e){ console.error('Error loading NHome session', e) } finally{ setLoading(false) }
  }

  function calculateScore(results:any[]): number{
    if(results.length===0) return 0
    const total=results.length
    const issue=results.filter((r:any)=>r.status==='issue').length
    const critical=results.filter((r:any)=>r.status==='critical').length
    const base=((total-issue)/total)*10
    const penalty=critical*2
    return Math.max(1, Math.round((base-penalty)*10)/10)
  }

  async function saveNHomeResult(
    itemId: string,
    status: 'good' | 'issue' | 'critical',
    notes: string,
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

    if (status !== 'good' && notes) {
      payload.notes = notes
    }

    const { error: upsertError } = await supabase.from('inspection_results').upsert(payload)
    if (upsertError) {
      console.error('[NHomeSession] Failed to upsert inspection result', {
        sessionId,
        itemId,
        error: upsertError.message,
        code: upsertError.code,
      })
      throw upsertError
    }

    // Update session progress incrementally
    const totalItems = session?.checklist_items?.length ?? 0
    const rawScore = Number(nhomeProgress.quality_score || 0)
    const clamped = Math.max(1, Math.min(10, rawScore))
    const safeScoreInt = Math.round(clamped)
    const updates: any = { nhome_quality_score: safeScoreInt }

    // Only advance if explicitly requested
    if (shouldAdvance) {
      const nextIndex = (session?.current_item_index ?? 0) + 1
      updates.current_item_index = nextIndex
      if (totalItems > 0 && nextIndex >= totalItems) {
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
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

  return { session, currentItem, loading, nhomeProgress, saveNHomeResult, reload: load }
}
