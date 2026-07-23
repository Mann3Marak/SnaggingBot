// Shared booking domain types + presentation metadata used by both API routes
// and client components.

export type BookingStatus = 'tentative' | 'confirmed' | 'cancelled' | 'completed'

export type BookingEventType =
  | 'arrival'
  | 'departure'
  | 'delivery'
  | 'cleaning'
  | 'inspection'

export interface BookingEvent {
  id: string
  booking_id: string
  event_type: BookingEventType
  event_date: string // YYYY-MM-DD
  event_time: string | null // HH:mm[:ss]
  title: string | null
  notes: string | null
  outlook_event_id: string | null
  outlook_synced_at: string | null
  created_at?: string
  updated_at?: string
}

export interface Booking {
  id: string
  company_id: string | null
  apartment_id: string | null
  guest_name: string | null
  arrival_date: string | null
  departure_date: string | null
  budget: number | null
  notes: string | null
  status: BookingStatus
  outlook_event_id?: string | null
  outlook_synced_at?: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // Optionally hydrated by the API:
  events?: BookingEvent[]
  apartment?: {
    id: string
    unit_number: string | null
    apartment_type: string | null
    building_number: string | null
  } | null
}

export interface BookingAuditEntry {
  id: string
  booking_id: string | null
  action: string
  actor_id: string | null
  actor_email: string | null
  changes: Record<string, unknown> | null
  created_at: string
}

// The event types a user can add manually in the form. Arrival/departure are
// derived from the booking's own dates, so they are not created here.
export const MANUAL_EVENT_TYPES: BookingEventType[] = [
  'delivery',
  'cleaning',
  'inspection',
]

// Presentation tokens for calendar markers, aligned with DESIGN.md.
export const EVENT_META: Record<
  BookingEventType,
  { label: string; color: string; bg: string; dot: string }
> = {
  arrival: { label: 'Arrival', color: '#166534', bg: '#dcfce7', dot: '#16a34a' },
  departure: { label: 'Departure', color: '#9a3412', bg: '#ffedd5', dot: '#ea580c' },
  delivery: { label: 'Delivery', color: '#3730a3', bg: '#e0e7ff', dot: '#4f46e5' },
  cleaning: { label: 'Cleaning', color: '#155e75', bg: '#cffafe', dot: '#0891b2' },
  inspection: { label: 'Inspection', color: '#4b4105', bg: '#f3e399', dot: '#94874a' },
}

export const STATUS_META: Record<
  BookingStatus,
  { label: string; bg: string; text: string }
> = {
  tentative: { label: 'Tentative', bg: 'bg-slate-100', text: 'text-slate-700' },
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-800' },
  completed: { label: 'Completed', bg: 'bg-nhome-primary/10', text: 'text-nhome-primary' },
}

// Normalise raw event input into insertable booking_event rows. Only manual event
// types (delivery/cleaning/inspection) with a date are kept. Lives here (not in a
// route file) because Next.js route modules may only export request handlers.
export function sanitizeEvents(events: unknown, bookingId: string) {
  if (!Array.isArray(events)) return []
  return events
    .filter(
      (e) =>
        e &&
        MANUAL_EVENT_TYPES.includes(e.event_type as BookingEventType) &&
        e.event_date
    )
    .map((e) => ({
      booking_id: bookingId,
      event_type: e.event_type as BookingEventType,
      event_date: e.event_date as string,
      event_time: (e.event_time as string) || null,
      title: (e.title as string) || null,
      notes: (e.notes as string) || null,
    }))
}

export function apartmentLabel(apt?: Booking['apartment']): string {
  if (!apt) return 'Unassigned'
  const unit = apt.unit_number ? `Unit ${apt.unit_number}` : 'Unit —'
  const building = apt.building_number ? `Bldg ${apt.building_number} · ` : ''
  return `${building}${unit}`
}
