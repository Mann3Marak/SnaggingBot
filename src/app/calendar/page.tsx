'use client'
import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useNHomeBookings } from '@/hooks/useNHomeBookings'
import BookingForm from '@/components/calendar/BookingForm'
import ApartmentCalendarView from '@/components/calendar/ApartmentCalendarView'
import OverviewTimeline from '@/components/calendar/OverviewTimeline'
import HistoryView from '@/components/calendar/HistoryView'
import ReportsView from '@/components/calendar/ReportsView'
import { STATUS_META, apartmentLabel, type Booking } from '@/lib/bookings'

type Tab = 'list' | 'apartment' | 'overview' | 'history' | 'reports'

export default function CalendarPage() {
  const {
    bookings,
    loading,
    error,
    createBooking,
    updateBooking,
    deleteBooking,
    syncOutlook,
  } = useNHomeBookings()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [tab, setTab] = useState<Tab>('list')

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (b: Booking) => {
    setEditing(b)
    setFormOpen(true)
  }

  const handleSubmit = async (payload: Record<string, unknown>) => {
    if (payload.id) await updateBooking(payload)
    else await createBooking(payload)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'list', label: 'Bookings' },
    { key: 'apartment', label: 'Per apartment' },
    { key: 'overview', label: 'All apartments' },
    { key: 'reports', label: 'Reports' },
    { key: 'history', label: 'History' },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-nhome-foreground">Calendar</h1>
          <p className="mt-1 text-slate-600">
            Bookings, deliveries, cleanings and inspections across your apartments.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-nhome-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-nhome-secondary"
        >
          <PlusIcon className="h-4 w-4" /> New booking
        </button>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-nhome-primary text-nhome-primary'
                : 'border-transparent text-slate-500 hover:text-nhome-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {tab === 'list' && (
          <BookingList
            bookings={bookings}
            loading={loading}
            error={error}
            onEdit={openEdit}
            onDelete={deleteBooking}
            onSync={syncOutlook}
          />
        )}
        {tab === 'apartment' && (
          <ApartmentCalendarView bookings={bookings} onSelectBooking={openEdit} />
        )}
        {tab === 'overview' && (
          <OverviewTimeline bookings={bookings} onSelectBooking={openEdit} />
        )}
        {tab === 'reports' && <ReportsView bookings={bookings} />}
        {tab === 'history' && <HistoryView limit={200} />}
      </section>

      <BookingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />
    </main>
  )
}

function BookingList({
  bookings,
  loading,
  error,
  onEdit,
  onDelete,
  onSync,
}: {
  bookings: Booking[]
  loading: boolean
  error: string | null
  onEdit: (b: Booking) => void
  onDelete: (id: string) => Promise<void>
  onSync: (id: string) => Promise<unknown>
}) {
  if (loading) return <p className="text-sm text-slate-500">Loading bookings…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (bookings.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600">
          No bookings yet. Create your first one to get started.
        </p>
      </div>
    )

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bookings.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          onEdit={onEdit}
          onDelete={onDelete}
          onSync={onSync}
        />
      ))}
    </div>
  )
}

function BookingCard({
  booking: b,
  onEdit,
  onDelete,
  onSync,
}: {
  booking: Booking
  onEdit: (b: Booking) => void
  onDelete: (id: string) => Promise<void>
  onSync: (id: string) => Promise<unknown>
}) {
  const status = STATUS_META[b.status]
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      await onSync(b.id)
      setSyncMsg('Synced to Outlook ✓')
    } catch (err: any) {
      setSyncMsg(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-nhome-primary">{b.guest_name || 'Guest'}</h3>
          <p className="text-xs text-slate-500">{apartmentLabel(b.apartment)}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">
        {formatDate(b.arrival_date)} → {formatDate(b.departure_date)}
      </p>
      {b.budget != null && (
        <p className="mt-1 text-xs text-slate-500">Budget €{b.budget}</p>
      )}
      {b.events && b.events.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {b.events.length} event{b.events.length > 1 ? 's' : ''} scheduled
        </p>
      )}
      {b.outlook_synced_at && (
        <p className="mt-1 text-xs text-emerald-600">Outlook synced</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onEdit(b)}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-nhome-primary hover:text-nhome-primary"
        >
          Edit
        </button>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-nhome-primary hover:text-nhome-primary disabled:opacity-60"
        >
          {syncing ? 'Syncing…' : 'Sync to Outlook'}
        </button>
        <button
          onClick={() => {
            if (confirm('Delete this booking?')) onDelete(b.id)
          }}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-red-400 hover:text-red-600"
        >
          Delete
        </button>
      </div>
      {syncMsg && <p className="mt-2 text-xs text-slate-500">{syncMsg}</p>}
    </article>
  )
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
