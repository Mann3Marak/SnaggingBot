'use client'
import { useEffect, useState } from 'react'

interface AuditEntry {
  id: string
  booking_id: string | null
  action: string
  actor_email: string | null
  changes: any
  created_at: string
  booking?: {
    id: string
    guest_name: string | null
    arrival_date: string | null
    departure_date: string | null
    apartment?: { unit_number: string | null; building_number: string | null } | null
  } | null
}

const ACTION_META: Record<string, { label: string; dot: string }> = {
  created: { label: 'Created', dot: '#16a34a' },
  updated: { label: 'Updated', dot: '#94874a' },
  deleted: { label: 'Deleted', dot: '#dc2626' },
}

interface Props {
  bookingId?: string
  limit?: number
}

export default function HistoryView({ bookingId, limit }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (bookingId) params.set('bookingId', bookingId)
    if (limit) params.set('limit', String(limit))
    fetch(`/api/nhome/bookings/history?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        if (d.error) setError(d.error)
        else setEntries(d.history ?? [])
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [bookingId, limit])

  if (loading) return <p className="text-sm text-slate-500">Loading history…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (entries.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">No history yet.</p>
      </div>
    )

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-6">
      {entries.map((e) => {
        const meta = ACTION_META[e.action] ?? { label: e.action, dot: '#64748b' }
        return (
          <li key={e.id} className="relative">
            <span
              className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-2 ring-white"
              style={{ backgroundColor: meta.dot }}
            />
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-nhome-primary">
                  {meta.label}
                  {e.booking?.guest_name ? ` — ${e.booking.guest_name}` : ''}
                </span>
                <time className="text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {describeBooking(e)}
                {e.actor_email ? ` · by ${e.actor_email}` : ''}
              </p>
              {e.action === 'updated' && (
                <ChangeSummary changes={e.changes} />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function describeBooking(e: AuditEntry): string {
  const apt = e.booking?.apartment
  if (apt?.unit_number) {
    return `${apt.building_number ? `Bldg ${apt.building_number} · ` : ''}Unit ${apt.unit_number}`
  }
  const b = e.changes?.before ?? e.changes?.booking ?? e.changes?.after
  if (b?.arrival_date) return `${b.arrival_date} → ${b.departure_date ?? ''}`
  return 'Booking'
}

// Renders the changed fields between before/after snapshots for an update.
function ChangeSummary({ changes }: { changes: any }) {
  const before = changes?.before ?? {}
  const after = changes?.after ?? {}
  const fields = ['guest_name', 'arrival_date', 'departure_date', 'budget', 'status', 'apartment_id', 'notes']
  const diffs = fields
    .filter((f) => before[f] !== after[f] && (before[f] != null || after[f] != null))
    .map((f) => ({ field: f, from: before[f], to: after[f] }))

  if (diffs.length === 0) return null
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
      {diffs.map((d) => (
        <li key={d.field}>
          <span className="font-medium">{prettyField(d.field)}:</span>{' '}
          <span className="text-slate-400 line-through">{fmt(d.from)}</span> →{' '}
          <span className="text-slate-700">{fmt(d.to)}</span>
        </li>
      ))}
    </ul>
  )
}

function prettyField(f: string): string {
  return f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function fmt(v: unknown): string {
  if (v == null || v === '') return '—'
  return String(v)
}
