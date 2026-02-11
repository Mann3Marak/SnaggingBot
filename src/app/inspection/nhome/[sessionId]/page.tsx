"use client"
import { useParams } from 'next/navigation'
import { useNHomeInspectionSession } from '@/hooks/useNHomeInspectionSession'
import { NHomeVoiceInspection } from '@/components/inspection/NHomeVoiceInspection'
import NHomeReportGenerator from '@/components/reports/NHomeReportGenerator'

export default function InspectionPage(){
  const params = useParams<{ sessionId?: string }>()
  const sessionIdParam = params?.sessionId

  if (typeof sessionIdParam !== 'string' || sessionIdParam.length === 0) {
    return <main className='p-6'>Session not found.</main>
  }

  const sessionId = sessionIdParam
  const { session, loading, nhomeProgress } = useNHomeInspectionSession(sessionId)

  if (loading) return <main className='p-6'>Loading NHome inspection...</main>
  if (!session) return <main className='p-6'>Session not found.</main>

  return (
    <main className='p-6 space-y-6'>
      <section className='rounded-xl border border-slate-200 bg-white p-0 overflow-hidden'>
        <NHomeVoiceInspection sessionId={sessionId} />
      </section>

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
