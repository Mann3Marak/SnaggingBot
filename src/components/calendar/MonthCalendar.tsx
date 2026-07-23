'use client'
import { useMemo } from 'react'
import {
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
} from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import {
  getMonthGrid,
  getWeekSegments,
  getDayMarkers,
} from '@/lib/calendar-utils'
import { EVENT_META, STATUS_META, type Booking } from '@/lib/bookings'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const LANE_HEIGHT = 20 // px per stay bar
const MAX_LANES = 3

interface MonthCalendarProps {
  month: Date
  onMonthChange: (m: Date) => void
  bookings: Booking[]
  onSelectBooking?: (b: Booking) => void
}

export default function MonthCalendar({
  month,
  onMonthChange,
  bookings,
  onSelectBooking,
}: MonthCalendarProps) {
  const weeks = useMemo(() => getMonthGrid(month), [month])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-center gap-4">
        <button
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-nhome-primary"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-semibold text-nhome-primary sm:text-base">
          {format(month, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-nhome-primary"
          aria-label="Next month"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-100 pb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div>
        {weeks.map((week, wi) => {
          const segments = getWeekSegments(week, bookings)
          const laneCount = Math.min(
            MAX_LANES,
            segments.reduce((m, s) => Math.max(m, s.lane + 1), 0)
          )
          const barsAreaHeight = laneCount * LANE_HEIGHT

          return (
            <div key={wi} className="relative border-b border-slate-100 last:border-b-0">
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {week.map((day, di) => {
                  const inMonth = isSameMonth(day, month)
                  const markers = getDayMarkers(day, bookings).filter(
                    (m) => m.type !== 'arrival' && m.type !== 'departure'
                  )
                  return (
                    <div
                      key={di}
                      className={`min-h-[76px] border-r border-slate-100 px-1 pt-1 last:border-r-0 ${
                        inMonth ? '' : 'bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          isToday(day)
                            ? 'bg-nhome-error font-semibold text-white'
                            : inMonth
                            ? 'text-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {format(day, 'd')}
                      </div>
                      {/* Reserve space for stay bars, then event dots below */}
                      <div style={{ height: barsAreaHeight }} />
                      {markers.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {markers.slice(0, 4).map((m, mi) => (
                            <span
                              key={mi}
                              title={`${EVENT_META[m.type].label}${
                                m.booking.guest_name ? ` · ${m.booking.guest_name}` : ''
                              }`}
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: EVENT_META[m.type].dot }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Stay bars overlaid on top of the day cells */}
              <div
                className="pointer-events-none absolute inset-x-0"
                style={{ top: 28 }}
              >
                {segments
                  .filter((s) => s.lane < MAX_LANES)
                  .map((s, si) => {
                    const status = STATUS_META[s.booking.status]
                    return (
                      <button
                        key={si}
                        onClick={() => onSelectBooking?.(s.booking)}
                        className={`pointer-events-auto absolute truncate px-2 text-left text-[11px] font-medium text-white shadow-sm ${status.bg} ${status.text}`}
                        style={{
                          left: `calc(${(s.startCol / 7) * 100}% + 2px)`,
                          width: `calc(${(s.span / 7) * 100}% - 4px)`,
                          top: s.lane * LANE_HEIGHT,
                          height: LANE_HEIGHT - 3,
                          lineHeight: `${LANE_HEIGHT - 3}px`,
                          borderTopLeftRadius: s.continuesLeft ? 0 : 6,
                          borderBottomLeftRadius: s.continuesLeft ? 0 : 6,
                          borderTopRightRadius: s.continuesRight ? 0 : 6,
                          borderBottomRightRadius: s.continuesRight ? 0 : 6,
                          backgroundColor: statusBarColor(s.booking.status),
                        }}
                        title={`${s.booking.guest_name || 'Guest'} · ${status.label}`}
                      >
                        {s.booking.guest_name || 'Guest'}
                      </button>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>

      <Legend />
    </div>
  )
}

function statusBarColor(status: Booking['status']): string {
  switch (status) {
    case 'confirmed':
      return '#3a7d6e' // teal, matching the reference calendar bars
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

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3">
      {(['delivery', 'cleaning', 'inspection'] as const).map((t) => (
        <span key={t} className="flex items-center gap-1 text-xs text-slate-500">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: EVENT_META[t].dot }}
          />
          {EVENT_META[t].label}
        </span>
      ))}
    </div>
  )
}
