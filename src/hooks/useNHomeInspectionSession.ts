"use client"
import { useEffect, useState } from 'react'

export function useNHomeInspectionSession(sessionId: string){
  const [session, setSession] = useState<any>(null)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [nhomeProgress, setNHomeProgress] = useState({ completed: 0, total: 0, issues_found: 0, quality_score: 0 })

  useEffect(()=>{ load() },[sessionId])

  async function load(){
    setLoading(true)
    try{
      const res = await fetch(
        `/api/nhome/inspections/${sessionId}/full?ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        console.error("Failed to load inspection session:", await res.text());
        setLoading(false);
        return;
      }

      const { session: sessionData } = await res.json();

      if (!sessionData?.apartment?.apartment_type) {
        console.warn(
          `?? No checklist templates found for apartment type: ${sessionData?.apartment?.apartment_type}`
        );
      }

      // Ensure checklist items are sorted by order_sequence
      const sortedItems = [...(sessionData?.checklist_items ?? [])].sort(
        (a, b) => (a.order_sequence ?? 0) - (b.order_sequence ?? 0)
      );
      sessionData.checklist_items = sortedItems;

      const serverIndexRaw = Number(sessionData?.current_item_index ?? 0);
      const normalizedIndex = Number.isFinite(serverIndexRaw)
        ? Math.max(0, serverIndexRaw)
        : 0;

      const items = sessionData?.checklist_items ?? [];
      const clampedIndex =
        items.length > 0 ? Math.min(normalizedIndex, items.length - 1) : 0;
      const newItem =
        items.length > 0 && Number.isFinite(clampedIndex)
          ? { ...items[clampedIndex] }
          : null;

      const normalizedSession = {
        ...sessionData,
        current_item_index: normalizedIndex,
        checklist_items: items,
      };

      setSession(normalizedSession);

      const results = sessionData?.results ?? [];
      const completed = results.length;
      const total = items.length;
      const issues_found = results.filter((r:any)=>r.status==='issue').length;
      const quality_score = calculateScore(results);
      setNHomeProgress({ completed, total, issues_found, quality_score });

      console.log("[Session] reloaded index:", normalizedIndex);
      console.log("[Session] checklist length:", items.length);
      console.log("[Session] current item:", newItem?.item_description);
      setCurrentItem(newItem);
      return { session: normalizedSession };
    }catch(e){ 
      console.error('Error loading NHome session', e);
      return null;
    } finally{ 
      setLoading(false);
    }
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
    console.log("[Result] saveNHomeResult called with:", {
      sessionId,
      itemId,
      status,
      notes,
      priority,
      photos,
      shouldAdvance,
    });

    const response = await fetch("/api/nhome/inspections/save-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        itemId,
        status,
        notes,
        priority,
        photos,
        shouldAdvance,
      }),
    });

    console.log("[Result] response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Result] save failed:", errorText);
      return;
    }

    const result = await response.json();
    console.log("[Result] save success:", result);

    await load();
  }

  return { session, currentItem, loading, nhomeProgress, saveNHomeResult, reload: load, setSession, setCurrentItem }
}

