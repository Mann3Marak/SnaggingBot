'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Booking } from '@/lib/bookings'

export interface ApartmentOption {
  id: string
  unit_number: string | null
  apartment_type: string | null
  building_number: string | null
  client_name?: string | null
  client_surname?: string | null
  project_id?: string | null
  projects?: { id: string; name: string } | null
}

interface UseBookingsOptions {
  apartmentId?: string | null
  from?: string | null
  to?: string | null
}

/**
 * Data hook for bookings — mirrors the repo's plain-fetch pattern (no React Query).
 * Loads bookings for an optional apartment/date window and exposes CRUD helpers
 * that re-fetch on success.
 */
export function useNHomeBookings(options: UseBookingsOptions = {}) {
  const { apartmentId, from, to } = options
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (apartmentId) params.set('apartmentId', apartmentId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/nhome/bookings/list?${params.toString()}`, {
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load bookings')
      setBookings(data.bookings ?? [])
    } catch (err: any) {
      setError(err.message)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [apartmentId, from, to])

  useEffect(() => {
    reload()
  }, [reload])

  const createBooking = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/nhome/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')
      await reload()
      return data.booking as Booking
    },
    [reload]
  )

  const updateBooking = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/nhome/bookings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update booking')
      await reload()
      return data.booking as Booking
    },
    [reload]
  )

  const deleteBooking = useCallback(
    async (id: string) => {
      const res = await fetch('/api/nhome/bookings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete booking')
      await reload()
    },
    [reload]
  )

  const syncOutlook = useCallback(
    async (id: string) => {
      const res = await fetch('/api/nhome/bookings/sync-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to sync to Outlook')
      await reload()
      return data
    },
    [reload]
  )

  return {
    bookings,
    loading,
    error,
    reload,
    createBooking,
    updateBooking,
    deleteBooking,
    syncOutlook,
  }
}

/** Loads all apartments once, for pickers and the overview grid. */
export function useApartmentOptions() {
  const [apartments, setApartments] = useState<ApartmentOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/nhome/apartments/all', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active) setApartments(d.apartments ?? [])
      })
      .catch((err) => console.error('Error loading apartments:', err))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { apartments, loading }
}
