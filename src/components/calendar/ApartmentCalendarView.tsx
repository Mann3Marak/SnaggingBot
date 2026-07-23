'use client'
import { useMemo, useState } from 'react'
import MonthCalendar from './MonthCalendar'
import { apartmentLabel, type Booking } from '@/lib/bookings'
import { useApartmentOptions } from '@/hooks/useNHomeBookings'

interface Props {
  bookings: Booking[]
  onSelectBooking?: (b: Booking) => void
}

export default function ApartmentCalendarView({ bookings, onSelectBooking }: Props) {
  const { apartments } = useApartmentOptions()
  const [apartmentId, setApartmentId] = useState<string>('')
  const [month, setMonth] = useState<Date>(() => startOfCurrentMonth())

  const filtered = useMemo(() => {
    if (!apartmentId) return bookings.filter((b) => !b.apartment_id)
    return bookings.filter((b) => b.apartment_id === apartmentId)
  }, [bookings, apartmentId])

  const sortedApartments = useMemo(
    () =>
      [...apartments].sort((a, b) =>
        apartmentLabel(a as any).localeCompare(apartmentLabel(b as any))
      ),
    [apartments]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm font-medium text-slate-600">
          Apartment
          <select
            value={apartmentId}
            onChange={(e) => setApartmentId(e.target.value)}
            className="ml-2 rounded-lg border p-2 text-sm"
          >
            <option value="">Unassigned bookings</option>
            {sortedApartments.map((apt) => (
              <option key={apt.id} value={apt.id}>
                {apartmentLabel(apt as any)}
                {apt.apartment_type ? ` · ${apt.apartment_type}` : ''}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400">
          {filtered.length} booking{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        bookings={filtered}
        onSelectBooking={onSelectBooking}
      />
    </div>
  )
}

function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}
