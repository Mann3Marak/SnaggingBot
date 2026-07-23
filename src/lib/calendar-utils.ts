import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  differenceInCalendarDays,
  parseISO,
  isWithinInterval,
  max as maxDate,
  min as minDate,
} from 'date-fns'
import type { Booking, BookingEvent, BookingEventType } from './bookings'

export const WEEK_STARTS_ON = 0 // Sunday, to match the existing app calendars

/** Parse a YYYY-MM-DD string to a local-midnight Date. */
export function parseDay(d: string): Date {
  return parseISO(d)
}

/** Full grid of days (leading/trailing days included) for a given month. */
export function getMonthGrid(month: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

export interface BookingSegment {
  booking: Booking
  startCol: number // 0-6 within the week
  span: number // number of columns
  continuesLeft: boolean
  continuesRight: boolean
  lane: number
}

/**
 * For a single week, compute the stay bars (with lane assignment so overlapping
 * bookings stack rather than collide), matching the "Onboarding" bar look.
 */
export function getWeekSegments(week: Date[], bookings: Booking[]): BookingSegment[] {
  const weekStart = week[0]
  const weekEnd = week[6]

  const raw = bookings
    .filter((b) => b.arrival_date && b.departure_date)
    .map((b) => {
      const arrival = parseDay(b.arrival_date as string)
      const departure = parseDay(b.departure_date as string)
      return { b, arrival, departure }
    })
    .filter(({ arrival, departure }) => departure >= weekStart && arrival <= weekEnd)
    .sort((a, b) => a.arrival.getTime() - b.arrival.getTime())

  const laneEnds: number[] = [] // last used column per lane
  const segments: BookingSegment[] = []

  for (const { b, arrival, departure } of raw) {
    const segStart = maxDate([arrival, weekStart])
    const segEnd = minDate([departure, weekEnd])
    const startCol = differenceInCalendarDays(segStart, weekStart)
    const span = differenceInCalendarDays(segEnd, segStart) + 1

    let lane = laneEnds.findIndex((end) => end < startCol)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(startCol + span - 1)
    } else {
      laneEnds[lane] = startCol + span - 1
    }

    segments.push({
      booking: b,
      startCol,
      span,
      continuesLeft: arrival < weekStart,
      continuesRight: departure > weekEnd,
      lane,
    })
  }

  return segments
}

export interface DayMarker {
  type: BookingEventType
  booking: Booking
  event?: BookingEvent
}

/** Point markers (arrival/departure + delivery/cleaning/inspection) on a given day. */
export function getDayMarkers(day: Date, bookings: Booking[]): DayMarker[] {
  const markers: DayMarker[] = []
  for (const b of bookings) {
    if (b.arrival_date && isSameISODay(day, b.arrival_date)) {
      markers.push({ type: 'arrival', booking: b })
    }
    if (b.departure_date && isSameISODay(day, b.departure_date)) {
      markers.push({ type: 'departure', booking: b })
    }
    for (const ev of b.events ?? []) {
      if (isSameISODay(day, ev.event_date)) {
        markers.push({ type: ev.event_type, booking: b, event: ev })
      }
    }
  }
  return markers
}

export function isSameISODay(day: Date, iso: string): boolean {
  const d = parseDay(iso)
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  )
}

export function dayIsWithinBooking(day: Date, booking: Booking): boolean {
  if (!booking.arrival_date || !booking.departure_date) return false
  return isWithinInterval(day, {
    start: parseDay(booking.arrival_date),
    end: parseDay(booking.departure_date),
  })
}
