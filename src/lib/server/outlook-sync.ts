import { getAppGraphToken } from './nhome-graph-auth'
import { EVENT_META, type Booking, type BookingEvent } from '@/lib/bookings'
import { addDays, format } from 'date-fns'

// --- Configuration -----------------------------------------------------------
// Two-way Outlook sync uses Microsoft Graph *application* permissions
// (Calendars.ReadWrite, admin-consented) writing to a designated shared mailbox
// / calendar, since the client-credentials token is not tied to a signed-in user.

export function outlookConfig() {
  const user = process.env.NHOME_OUTLOOK_USER // UPN or object id of the target mailbox
  const calendarId = process.env.NHOME_OUTLOOK_CALENDAR_ID // optional specific calendar
  const timeZone = process.env.NHOME_OUTLOOK_TIMEZONE || 'GMT Standard Time'
  return { user, calendarId, timeZone, configured: Boolean(user) }
}

export function isOutlookConfigured(): boolean {
  return outlookConfig().configured
}

function eventsBase(): string {
  const { user, calendarId } = outlookConfig()
  const root = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user!)}`
  return calendarId
    ? `${root}/calendars/${encodeURIComponent(calendarId)}/events`
    : `${root}/events`
}

async function graphFetch(url: string, init: RequestInit) {
  const token = await getAppGraphToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Graph ${init.method || 'GET'} ${res.status}: ${detail}`)
  }
  return res.status === 204 ? null : res.json()
}

// --- Payload builders --------------------------------------------------------

function bookingLabel(booking: Booking): string {
  const guest = booking.guest_name || 'Guest'
  const apt = booking.apartment
  const unit = apt?.unit_number ? ` · Unit ${apt.unit_number}` : ''
  return `${guest}${unit}`
}

/** All-day stay event spanning arrival → departure (Graph end date is exclusive). */
export function buildStayEvent(booking: Booking) {
  const { timeZone } = outlookConfig()
  const endExclusive = booking.departure_date
    ? format(addDays(new Date(booking.departure_date + 'T00:00:00'), 1), 'yyyy-MM-dd')
    : booking.arrival_date!
  return {
    subject: `Stay — ${bookingLabel(booking)}`,
    body: {
      contentType: 'text',
      content: booking.notes || 'NHome booking',
    },
    isAllDay: true,
    start: { dateTime: `${booking.arrival_date}T00:00:00`, timeZone },
    end: { dateTime: `${endExclusive}T00:00:00`, timeZone },
    categories: ['NHome Booking'],
    singleValueExtendedProperties: [
      // Tag with our booking id so inbound notifications can be matched back.
      { id: 'String {a1b2c3d4-0000-0000-0000-nhome0001} Name NHomeBookingId', value: booking.id },
    ],
  }
}

/** Timed (or all-day) event for a delivery / cleaning / inspection. */
export function buildBookingEventPayload(booking: Booking, ev: BookingEvent) {
  const { timeZone } = outlookConfig()
  const meta = EVENT_META[ev.event_type]
  const hasTime = Boolean(ev.event_time)
  const startDateTime = hasTime
    ? `${ev.event_date}T${normalizeTime(ev.event_time!)}`
    : `${ev.event_date}T09:00:00`
  const endDateTime = hasTime
    ? `${ev.event_date}T${addHour(normalizeTime(ev.event_time!))}`
    : `${ev.event_date}T10:00:00`
  return {
    subject: `${meta.label} — ${bookingLabel(booking)}`,
    body: { contentType: 'text', content: ev.notes || '' },
    isAllDay: false,
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
    categories: ['NHome', meta.label],
    singleValueExtendedProperties: [
      { id: 'String {a1b2c3d4-0000-0000-0000-nhome0001} Name NHomeBookingId', value: booking.id },
      { id: 'String {a1b2c3d4-0000-0000-0000-nhome0002} Name NHomeEventId', value: ev.id },
    ],
  }
}

function normalizeTime(t: string): string {
  // Accept HH:mm or HH:mm:ss
  const parts = t.split(':')
  const hh = (parts[0] || '00').padStart(2, '0')
  const mm = (parts[1] || '00').padStart(2, '0')
  const ss = (parts[2] || '00').padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
function addHour(t: string): string {
  const [hh, mm, ss] = t.split(':').map(Number)
  const h = (hh + 1) % 24
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// --- CRUD against Graph ------------------------------------------------------

export async function createGraphEvent(payload: unknown): Promise<{ id: string }> {
  const data = await graphFetch(eventsBase(), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { id: data.id }
}

export async function updateGraphEvent(eventId: string, payload: unknown): Promise<void> {
  const { user, calendarId } = outlookConfig()
  const root = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user!)}`
  const base = calendarId
    ? `${root}/calendars/${encodeURIComponent(calendarId)}/events`
    : `${root}/events`
  await graphFetch(`${base}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteGraphEvent(eventId: string): Promise<void> {
  const { user, calendarId } = outlookConfig()
  const root = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user!)}`
  const base = calendarId
    ? `${root}/calendars/${encodeURIComponent(calendarId)}/events`
    : `${root}/events`
  try {
    await graphFetch(`${base}/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
  } catch (err: any) {
    // 404 means it's already gone — treat as success.
    if (!String(err?.message).includes('404')) throw err
  }
}

export async function getGraphEvent(eventId: string): Promise<any> {
  const { user, calendarId } = outlookConfig()
  const root = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user!)}`
  const base = calendarId
    ? `${root}/calendars/${encodeURIComponent(calendarId)}/events`
    : `${root}/events`
  return graphFetch(`${base}/${encodeURIComponent(eventId)}`, { method: 'GET' })
}
