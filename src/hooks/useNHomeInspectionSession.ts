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
      const supabase = getSupabase()
      const { data: sessionData } = await supabase
        .from('inspection_sessions')
        .select('*, apartments (*, projects (*))')
        .eq('id', sessionId)
        .single()

      const { data: checklist } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('apartment_type', sessionData?.apartments?.apartment_type)
        .order('order_sequence')

      const { data: results } = await supabase
        .from('inspection_results')
        .select('*')
        .eq('session_id', sessionId)

      const enhanced = { ...sessionData, checklist_items: checklist ?? [], results: results ?? [], apartment: sessionData?.apartments, project: sessionData?.apartments?.projects }
      setSession(enhanced)

      const completed = results?.length ?? 0
      const total = checklist?.length ?? 0
      const issues_found = (results ?? []).filter((r:any)=>r.status==='issue').length
      const quality_score = calculateScore(results ?? [])
      setNHomeProgress({ completed, total, issues_found, quality_score })

      const idx = sessionData?.current_item_index ?? 0
      setCurrentItem(checklist?.[idx])
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

  async function saveNHomeResult(itemId:string, status:'good'|'issue'|'critical', notes:string, priority:number=1){
    const supabase = getSupabase()
    await supabase.from('inspection_results').upsert({ session_id: sessionId, item_id: itemId, status, notes, priority_level: priority, created_at: new Date().toISOString() })

    const totalItems = session?.checklist_items?.length ?? 0
    const nextIndex = (session?.current_item_index ?? 0) + 1
    // Respect DB check constraint: keep score within [1,10] when updating.
    const safeScore = Math.max(1, Math.min(10, Number(nhomeProgress.quality_score || 0)))
    const updates: any = { current_item_index: nextIndex, nhome_quality_score: safeScore }

    if (totalItems > 0 && nextIndex >= totalItems) {
      updates.status = 'completed'
      updates.completed_at = new Date().toISOString()
    }

    await supabase.from('inspection_sessions').update(updates).eq('id', sessionId)
    await load()
  }

  return { session, currentItem, loading, nhomeProgress, saveNHomeResult, reload: load }
}
