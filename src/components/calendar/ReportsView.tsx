'use client'
import { useMemo, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  differenceInCalendarDays,
  format,
  isWithinInterval,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { parseDay } from '@/lib/calendar-utils'
import { EVENT_META, apartmentLabel, type Booking } from '@/lib/bookings'
import { useApartmentOptions } from '@/hooks/useNHomeBookings'

type Period = 'week' | 'month'

interface Props {
  bookings: Booking[]
}

export default function ReportsView({ bookings }: Props) {
  const { apartments } = useApartmentOptions()
  const [period, setPeriod] = useState<Period>('week')
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const { start, end } = useMemo(() => bounds(period, anchor), [period, anchor])

  const stats = useMemo(
    () => computeStats(bookings, start, end, apartments.length),
    [bookings, start, end, apartments.length]
  )

  const perApartment = useMemo(
    () => computePerApartment(bookings, apartments, start, end),
    [bookings, apartments, start, end]
  )

  const step = (dir: number) =>
    setAnchor((a) => (period === 'week' ? addWeeks(a, dir) : addMonths(a, dir)))

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => step(-1)}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-nhome-primary"
            aria-label="Previous period"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-nhome-primary">
            {period === 'week'
              ? `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
              : format(start, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => step(1)}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-nhome-primary"
            aria-label="Next period"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-1">
          {(['week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${
                period === p
                  ? 'bg-nhome-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p}ly
            </button>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Occupancy" value={`${stats.occupancyPct}%`} accent />
        <StatTile label="Arrivals" value={stats.arrivals} />
        <StatTile label="Departures" value={stats.departures} />
        <StatTile label="Deliveries" value={stats.deliveries} dot={EVENT_META.delivery.dot} />
        <StatTile label="Cleanings" value={stats.cleanings} dot={EVENT_META.cleaning.dot} />
        <StatTile label="Inspections" value={stats.inspections} dot={EVENT_META.inspection.dot} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Nights booked" value={stats.nights} />
        <StatTile label="Active bookings" value={stats.activeBookings} />
        <StatTile label="Budget total" value={`€${stats.budgetTotal.toLocaleString()}`} accent />
      </div>

      {/* Per-apartment breakdown */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2">Apartment</th>
              <th className="px-4 py-2 text-center">Nights</th>
              <th className="px-4 py-2 text-center">Occupancy</th>
              <th className="px-4 py-2 text-center">Cleanings</th>
              <th className="px-4 py-2 text-center">Inspections</th>
              <th className="px-4 py-2 text-right">Budget</th>
            </tr>
          </thead>
          <tbody>
            {perApartment.map((r) => (
              <tr key={r.key} className="border-b border-slate-50 last:border-b-0">
                <td className="px-4 py-2 font-medium text-slate-700">{r.label}</td>
                <td className="px-4 py-2 text-center text-slate-600">{r.nights}</td>
                <td className="px-4 py-2 text-center text-slate-600">{r.occupancyPct}%</td>
                <td className="px-4 py-2 text-center text-slate-600">{r.cleanings}</td>
                <td className="px-4 py-2 text-center text-slate-600">{r.inspections}</td>
                <td className="px-4 py-2 text-right text-slate-600">
                  €{r.budget.toLocaleString()}
                </td>
              </tr>
            ))}
            {perApartment.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No apartment activity in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  accent,
  dot,
}: {
  label: string
  value: string | number
  accent?: boolean
  dot?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        {dot && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
        )}
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
      </div>
      <p
        className={`mt-1 text-2xl font-semibold ${
          accent ? 'text-nhome-primary' : 'text-slate-800'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function bounds(period: Period, anchor: Date) {
  if (period === 'week') {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 0 }),
      end: endOfWeek(anchor, { weekStartsOn: 0 }),
    }
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
}

function overlapNights(booking: Booking, start: Date, end: Date): number {
  if (!booking.arrival_date || !booking.departure_date) return 0
  const arrival = parseDay(booking.arrival_date)
  const departure = parseDay(booking.departure_date)
  const from = arrival > start ? arrival : start
  const to = departure < end ? departure : end
  const nights = differenceInCalendarDays(to, from)
  return nights > 0 ? nights : 0
}

function eventCounts(bookings: Booking[], start: Date, end: Date) {
  let deliveries = 0
  let cleanings = 0
  let inspections = 0
  for (const b of bookings) {
    for (const ev of b.events ?? []) {
      const d = parseDay(ev.event_date)
      if (!isWithinInterval(d, { start, end })) continue
      if (ev.event_type === 'delivery') deliveries++
      else if (ev.event_type === 'cleaning') cleanings++
      else if (ev.event_type === 'inspection') inspections++
    }
  }
  return { deliveries, cleanings, inspections }
}

function computeStats(
  bookings: Booking[],
  start: Date,
  end: Date,
  apartmentCount: number
) {
  const periodDays = differenceInCalendarDays(end, start) + 1
  const inPeriod = (d: string | null) =>
    d ? isWithinInterval(parseDay(d), { start, end }) : false

  const arrivals = bookings.filter((b) => inPeriod(b.arrival_date)).length
  const departures = bookings.filter((b) => inPeriod(b.departure_date)).length
  const nights = bookings.reduce((sum, b) => sum + overlapNights(b, start, end), 0)
  const activeBookings = bookings.filter((b) => overlapNights(b, start, end) > 0).length
  const budgetTotal = bookings
    .filter((b) => overlapNights(b, start, end) > 0)
    .reduce((sum, b) => sum + (b.budget ?? 0), 0)

  const available = Math.max(apartmentCount, 1) * periodDays
  const occupancyPct = Math.round((nights / available) * 100)

  const { deliveries, cleanings, inspections } = eventCounts(bookings, start, end)

  return {
    arrivals,
    departures,
    nights,
    activeBookings,
    budgetTotal,
    occupancyPct,
    deliveries,
    cleanings,
    inspections,
  }
}

function computePerApartment(
  bookings: Booking[],
  apartments: { id: string }[],
  start: Date,
  end: Date
) {
  const periodDays = differenceInCalendarDays(end, start) + 1
  return apartments
    .map((apt) => {
      const aptBookings = bookings.filter((b) => b.apartment_id === apt.id)
      const nights = aptBookings.reduce(
        (sum, b) => sum + overlapNights(b, start, end),
        0
      )
      const { cleanings, inspections } = eventCounts(aptBookings, start, end)
      const budget = aptBookings
        .filter((b) => overlapNights(b, start, end) > 0)
        .reduce((sum, b) => sum + (b.budget ?? 0), 0)
      return {
        key: apt.id,
        label: apartmentLabel(apt as any),
        nights,
        occupancyPct: Math.round((nights / periodDays) * 100),
        cleanings,
        inspections,
        budget,
      }
    })
    .filter((r) => r.nights > 0 || r.cleanings > 0 || r.inspections > 0)
    .sort((a, b) => b.nights - a.nights)
}
