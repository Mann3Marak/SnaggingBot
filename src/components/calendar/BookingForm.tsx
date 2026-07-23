'use client'
import { useEffect, useMemo, useState } from 'react'
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  MANUAL_EVENT_TYPES,
  EVENT_META,
  apartmentLabel,
  type Booking,
  type BookingEventType,
  type BookingStatus,
} from '@/lib/bookings'
import { useApartmentOptions } from '@/hooks/useNHomeBookings'

interface EventRow {
  event_type: BookingEventType
  event_date: string
  event_time: string
  notes: string
}

interface BookingFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>
  initial?: Booking | null
  defaultApartmentId?: string | null
}

const STATUS_OPTIONS: BookingStatus[] = [
  'tentative',
  'confirmed',
  'cancelled',
  'completed',
]

const emptyState = (defaultApartmentId?: string | null) => ({
  apartment_id: defaultApartmentId ?? '',
  guest_name: '',
  arrival_date: '',
  departure_date: '',
  budget: '',
  notes: '',
  status: 'confirmed' as BookingStatus,
})

export default function BookingForm({
  open,
  onClose,
  onSubmit,
  initial,
  defaultApartmentId,
}: BookingFormProps) {
  const { apartments } = useApartmentOptions()
  const [form, setForm] = useState(emptyState(defaultApartmentId))
  const [events, setEvents] = useState<EventRow[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const isEdit = Boolean(initial?.id)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        apartment_id: initial.apartment_id ?? '',
        guest_name: initial.guest_name ?? '',
        arrival_date: initial.arrival_date ?? '',
        departure_date: initial.departure_date ?? '',
        budget: initial.budget != null ? String(initial.budget) : '',
        notes: initial.notes ?? '',
        status: initial.status ?? 'confirmed',
      })
      setEvents(
        (initial.events ?? [])
          .filter((e) => MANUAL_EVENT_TYPES.includes(e.event_type))
          .map((e) => ({
            event_type: e.event_type,
            event_date: e.event_date,
            event_time: e.event_time ?? '',
            notes: e.notes ?? '',
          }))
      )
    } else {
      setForm(emptyState(defaultApartmentId))
      setEvents([])
    }
    setMessage('')
  }, [open, initial, defaultApartmentId])

  const sortedApartments = useMemo(
    () =>
      [...apartments].sort((a, b) =>
        apartmentLabel(a).localeCompare(apartmentLabel(b))
      ),
    [apartments]
  )

  if (!open) return null

  const addEvent = () =>
    setEvents((prev) => [
      ...prev,
      { event_type: 'cleaning', event_date: form.arrival_date || '', event_time: '', notes: '' },
    ])

  const updateEvent = (idx: number, patch: Partial<EventRow>) =>
    setEvents((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))

  const removeEvent = (idx: number) =>
    setEvents((prev) => prev.filter((_, i) => i !== idx))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload: Record<string, unknown> = {
        ...form,
        apartment_id: form.apartment_id || null,
        budget: form.budget === '' ? null : Number(form.budget),
        events: events.filter((ev) => ev.event_date),
      }
      if (isEdit) payload.id = initial!.id
      await onSubmit(payload)
      setMessage('✅ Saved')
      onClose()
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'border rounded-lg p-2 w-full text-sm'
  const labelClass = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-40 p-4">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-nhome-primary">
          {isEdit ? 'Edit booking' : 'New booking'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Apartment</label>
            <select
              value={form.apartment_id}
              onChange={(e) => setForm({ ...form, apartment_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Unassigned</option>
              {sortedApartments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {apartmentLabel(apt)}
                  {apt.apartment_type ? ` · ${apt.apartment_type}` : ''}
                  {apt.projects?.name ? ` — ${apt.projects.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Guest / client name</label>
            <input
              type="text"
              value={form.guest_name}
              onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Philippa Cox"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Arrival</label>
              <input
                type="date"
                value={form.arrival_date}
                onChange={(e) => setForm({ ...form, arrival_date: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Departure</label>
              <input
                type="date"
                value={form.departure_date}
                onChange={(e) => setForm({ ...form, departure_date: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as BookingStatus })
                }
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Budget (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Deliveries / cleanings / inspections */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelClass + ' mb-0'}>
                Deliveries, cleanings &amp; inspections
              </label>
              <button
                type="button"
                onClick={addEvent}
                className="inline-flex items-center gap-1 text-xs font-medium text-nhome-primary hover:underline"
              >
                <PlusIcon className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {events.length === 0 && (
                <p className="text-xs text-slate-400">No extra events yet.</p>
              )}
              {events.map((ev, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-nhome-background/40 p-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: EVENT_META[ev.event_type].dot }}
                    />
                    <select
                      value={ev.event_type}
                      onChange={(e) =>
                        updateEvent(idx, {
                          event_type: e.target.value as BookingEventType,
                        })
                      }
                      className="rounded border p-1 text-xs"
                    >
                      {MANUAL_EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {EVENT_META[t].label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={ev.event_date}
                      onChange={(e) => updateEvent(idx, { event_date: e.target.value })}
                      className="rounded border p-1 text-xs"
                    />
                    <input
                      type="time"
                      value={ev.event_time}
                      onChange={(e) => updateEvent(idx, { event_time: e.target.value })}
                      className="rounded border p-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeEvent(idx)}
                      className="ml-auto text-slate-400 hover:text-red-600"
                      aria-label="Remove event"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ev.notes}
                    onChange={(e) => updateEvent(idx, { notes: e.target.value })}
                    className="mt-2 w-full rounded border p-1 text-xs"
                    placeholder="Notes (optional)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
              rows={3}
              placeholder="Anything the team should know…"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-nhome-primary py-2 text-sm font-semibold text-white transition hover:bg-nhome-secondary disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create booking'}
          </button>
        </form>

        {message && (
          <p className="mt-3 text-center text-sm text-slate-700">{message}</p>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full text-sm text-slate-500 hover:text-nhome-primary"
        >
          Close
        </button>
      </div>
    </div>
  )
}
