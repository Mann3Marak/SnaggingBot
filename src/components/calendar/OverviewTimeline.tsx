'use client'
import { useMemo, useState } from 'react'
import {
  addDays,
  eachDayOfInterval,
  differenceInCalendarDays,
  format,
  isToday,
  isWeekend,
  startOfWeek,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { parseDay } from '@/lib/calendar-utils'
import { apartmentLabel, STATUS_META, type Booking } from '@/lib/bookings'
import { useApartmentOptions, type ApartmentOption } from '@/hooks/useNHomeBookings'

const DAY_WIDTH = 40 // px
const LABEL_WIDTH = 160 // px
const ROW_HEIGHT = 44 // px
const ZOOMS = [
  { label: 'Week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: 'Month', days: 35 },
]

interface Props {
  bookings: Booking[]
  onSelectBooking?: (b: Booking) => void
}

interface Row {
  key: string
  label: string
  apartment: ApartmentOption | null
}

export default function OverviewTimeline({ bookings, onSelectBooking }: Props) {
  const { apartments } = useApartmentOptions()
  const [rangeStart, setRangeStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )
  const [zoom, setZoom] = useState(ZOOMS[1])

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: rangeStart,
        end: addDays(rangeStart, zoom.days - 1),
      }),
    [rangeStart, zoom]
  )
  const rangeEnd = days[days.length - 1]

  const rows: Row[] = useMemo(() => {
    const sorted = [...apartments].sort((a, b) =>
      apartmentLabel(a as any).localeCompare(apartmentLabel(b as any))
    )
    const aptRows: Row[] = sorted.map((apt) => ({
      key: apt.id,
      label: apartmentLabel(apt as any),
      apartment: apt,
    }))
    // Include an unassigned lane only if there are unassigned bookings.
    const hasUnassigned = bookings.some((b) => !b.apartment_id)
    if (hasUnassigned)
      aptRows.push({ key: 'unassigned', label: 'Unassigned', apartment: null })
    return aptRows
  }, [apartments, bookings])

  const gridWidth = days.length * DAY_WIDTH

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRangeStart(addDays(rangeStart, -zoom.days))}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-nhome-primary"
            aria-label="Previous"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-nhome-primary">
            {format(rangeStart, 'd MMM')} – {format(rangeEnd, 'd MMM yyyy')}
          </span>
          <button
            onClick={() => setRangeStart(addDays(rangeStart, zoom.days))}
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-nhome-primary"
            aria-label="Next"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setRangeStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-nhome-primary hover:text-nhome-primary"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1">
          {ZOOMS.map((z) => (
            <button
              key={z.label}
              onClick={() => setZoom(z)}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                zoom.label === z.label
                  ? 'bg-nhome-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable timeline */}
      <div className="overflow-x-auto">
        <div style={{ width: LABEL_WIDTH + gridWidth }}>
          {/* Date header */}
          <div className="flex border-b border-slate-100">
            <div
              className="shrink-0 border-r border-slate-100 bg-white px-3 py-2 text-xs font-medium text-slate-400"
              style={{ width: LABEL_WIDTH, position: 'sticky', left: 0, zIndex: 2 }}
            >
              Listings
            </div>
            <div className="flex">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`shrink-0 border-r border-slate-100 py-1 text-center ${
                    isWeekend(day) ? 'bg-slate-50/70' : ''
                  }`}
                  style={{ width: DAY_WIDTH }}
                >
                  <div className="text-[10px] uppercase text-slate-400">
                    {format(day, 'EEEEE')}
                  </div>
                  <div
                    className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isToday(day)
                        ? 'bg-nhome-error font-semibold text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {rows.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              No apartments found. Add apartments to see them here.
            </div>
          )}
          {rows.map((row) => {
            const rowBookings = bookings.filter((b) =>
              row.apartment ? b.apartment_id === row.apartment.id : !b.apartment_id
            )
            return (
              <div key={row.key} className="flex border-b border-slate-100 last:border-b-0">
                <div
                  className="flex shrink-0 items-center border-r border-slate-100 bg-white px-3 text-xs font-medium text-slate-700"
                  style={{
                    width: LABEL_WIDTH,
                    height: ROW_HEIGHT,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                  }}
                >
                  <span className="truncate">{row.label}</span>
                </div>
                <div
                  className="relative"
                  style={{ width: gridWidth, height: ROW_HEIGHT }}
                >
                  {/* Day column backgrounds */}
                  {days.map((day, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 h-full border-r border-slate-100 ${
                        isWeekend(day) ? 'bg-slate-50/60' : ''
                      }`}
                      style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                    />
                  ))}
                  {/* Booking bars */}
                  {rowBookings.map((b) => {
                    const bar = barGeometry(b, rangeStart, rangeEnd)
                    if (!bar) return null
                    const status = STATUS_META[b.status]
                    return (
                      <button
                        key={b.id}
                        onClick={() => onSelectBooking?.(b)}
                        title={`${b.guest_name || 'Guest'} · ${status.label}`}
                        className="absolute truncate px-2 text-left text-[11px] font-medium text-white shadow-sm"
                        style={{
                          left: bar.left + 2,
                          width: bar.width - 4,
                          top: 8,
                          height: ROW_HEIGHT - 16,
                          lineHeight: `${ROW_HEIGHT - 16}px`,
                          backgroundColor: statusBarColor(b.status),
                          borderTopLeftRadius: bar.continuesLeft ? 0 : 6,
                          borderBottomLeftRadius: bar.continuesLeft ? 0 : 6,
                          borderTopRightRadius: bar.continuesRight ? 0 : 6,
                          borderBottomRightRadius: bar.continuesRight ? 0 : 6,
                        }}
                      >
                        {b.guest_name || 'Guest'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function barGeometry(booking: Booking, rangeStart: Date, rangeEnd: Date) {
  if (!booking.arrival_date || !booking.departure_date) return null
  const arrival = parseDay(booking.arrival_date)
  const departure = parseDay(booking.departure_date)
  if (departure < rangeStart || arrival > rangeEnd) return null
  const startClamped = arrival < rangeStart ? rangeStart : arrival
  const endClamped = departure > rangeEnd ? rangeEnd : departure
  const offset = differenceInCalendarDays(startClamped, rangeStart)
  const span = differenceInCalendarDays(endClamped, startClamped) + 1
  return {
    left: offset * DAY_WIDTH,
    width: span * DAY_WIDTH,
    continuesLeft: arrival < rangeStart,
    continuesRight: departure > rangeEnd,
  }
}

function statusBarColor(status: Booking['status']): string {
  switch (status) {
    case 'confirmed':
      return '#3a7d6e'
    case 'tentative':
      return '#94a3b8'
    case 'completed':
      return '#94874a'
    case 'cancelled':
      return '#cbd5e1'
    default:
      return '#3a7d6e'
  }
}
