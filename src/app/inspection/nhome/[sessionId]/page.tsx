"use client"
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { NHomeVoiceInspection } from '@/components/inspection/NHomeVoiceInspection'
import { SupabaseStatusBadge } from '@/components/auth/SupabaseStatusBadge'
import NHomeReportGenerator from '@/components/reports/NHomeReportGenerator'
import { NHomeReportPreview } from '@/components/reports/NHomeReportPreview'

export default function InspectionPage(){
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId
  const { session, currentItem, loading, nhomeProgress, saveNHomeResult } = useNHomeInspectionSession(sessionId)

  const [showNotes, setShowNotes] = useState<null | 'issue' | 'critical'>(null)
  const [notes, setNotes] = useState('')
  const [reportRefreshToken, setReportRefreshToken] = useState(0)

  if (loading) return <main className='p-6'>Loading NHome inspection…</main>
  if (!session) return <main className='p-6'>Session not found.</main>

  return (
    <main className='p-6 space-y-6'>
      {/* <header className='flex items-center justify-between gap-3'>
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
      </header> */}

      {/* Removed top-level Good/Issue/Critical section — now handled inside NHomeVoiceInspection */}
      {/* NHome Professional Voice Inspection */}
      <section className='rounded-xl border border-slate-200 bg-white p-0 overflow-hidden'>
        <NHomeVoiceInspection
          sessionId={sessionId}
          onRefreshReport={() => setReportRefreshToken((prev) => prev + 1)}
        />
      </section>

      {/* Live Report Preview temporarily disabled */}
      {false && (
        <section className='rounded-xl border border-slate-200 bg-white p-4 space-y-8'>
          <div>
            <h2 className='text-lg font-semibold mb-2'>Live Report Preview (English)</h2>
            <p className='text-sm text-slate-600 mb-4'>This report updates automatically as you progress through the inspection.</p>
            <NHomeReportPreview sessionId={sessionId} language="en" refreshToken={reportRefreshToken} />
          </div>
          <div>
            <h2 className='text-lg font-semibold mb-2'>Pré-visualização do Relatório (Português)</h2>
            <p className='text-sm text-slate-600 mb-4'>Este relatório é atualizado automaticamente à medida que avança na inspeção.</p>
            <NHomeReportPreview sessionId={sessionId} language="pt" refreshToken={reportRefreshToken} />
          </div>
        </section>
      )}

      {/* Always show Professional Report section, even if incomplete */}
      {nhomeProgress.total > 0 && (
        <section className='rounded-xl border border-emerald-200 bg-white p-4'>
          <h2 className='text-lg font-semibold mb-2'>Professional Report</h2>
          <p className='text-sm text-slate-600 mb-4'>
            {nhomeProgress.completed >= nhomeProgress.total
              ? 'Inspection complete. Generate and deliver NHome bilingual reports.'
              : 'Inspection in progress. You can still generate a partial professional report at any time.'}
          </p>
          <NHomeReportGenerator sessionId={sessionId} sessionData={session} />
        </section>
      )}
    </main>
  )
}
