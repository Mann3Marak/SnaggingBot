"use client"
import { useParams } from 'next/navigation'
import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { NHomeVoiceInspection } from '@/components/inspection/NHomeVoiceInspection'
import { SupabaseStatusBadge } from '@/components/auth/SupabaseStatusBadge'
import NHomeReportGenerator from '@/components/reports/NHomeReportGenerator'

export default function InspectionPage(){
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId
  const { session, currentItem, loading, nhomeProgress, saveNHomeResult } = useNHomeInspectionSession(sessionId)

  if (loading) return <main className='p-6'>Loading NHome inspection…</main>
  if (!session) return <main className='p-6'>Session not found.</main>

  return (
    <main className='p-6 space-y-6'>
      <header className='flex items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold'>Inspection • {session?.apartment?.apartment_type} • Unit {session?.apartment?.unit_number}</h1>
          <p className='text-sm text-slate-600'>{session?.project?.name} — {session?.project?.address}</p>
        </div>
        <div className='flex items-center gap-3'>
          <SupabaseStatusBadge />
          <div className='text-sm text-slate-600'>
            Progress: {nhomeProgress.completed}/{nhomeProgress.total} • Issues: {nhomeProgress.issues_found} • Score: {nhomeProgress.quality_score}
          </div>
        </div>
      </header>

      <section className='rounded-xl border border-slate-200 bg-white p-4'>
        {currentItem ? (
          <div>
            <p className='text-xs uppercase tracking-wide text-slate-500'>{currentItem.room_type}</p>
            <h2 className='mt-1 text-lg font-semibold'>{currentItem.item_description}</h2>
            {currentItem.item_description_pt && (
              <p className='text-sm text-slate-600'>PT: {currentItem.item_description_pt}</p>
            )}
            <div className='mt-4 flex gap-3'>
              <button onClick={() => saveNHomeResult(currentItem.id, 'good', '')} className='rounded-lg bg-emerald-600 px-4 py-2 text-white'>Good</button>
              <button onClick={() => saveNHomeResult(currentItem.id, 'issue', '')} className='rounded-lg bg-amber-500 px-4 py-2 text-white'>Issue</button>
              <button onClick={() => saveNHomeResult(currentItem.id, 'critical', '')} className='rounded-lg bg-red-600 px-4 py-2 text-white'>Critical</button>
            </div>
          </div>
        ) : (
          <p>All items completed. Great job.</p>
        )}
      </section>
      {/* NHome Professional Voice Inspection */}
      <section className='rounded-xl border border-slate-200 bg-white p-0 overflow-hidden'>
        <NHomeVoiceInspection sessionId={sessionId} />
      </section>

      {nhomeProgress.total > 0 && nhomeProgress.completed >= nhomeProgress.total && (
        <section className='rounded-xl border border-emerald-200 bg-white p-4'>
          <h2 className='text-lg font-semibold mb-2'>Professional Report</h2>
          <p className='text-sm text-slate-600 mb-4'>Inspection complete. Generate and deliver NHome bilingual reports.</p>
          <NHomeReportGenerator sessionId={sessionId} sessionData={session} />
        </section>
      )}
    </main>
  )
}
