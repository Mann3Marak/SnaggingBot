'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Owner } from '@/lib/owners'

/**
 * Owners data hook — plain-fetch pattern (no React Query), matching the rest of the app.
 */
export function useNHomeOwners() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nhome/owners/list', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load owners')
      setOwners(data.owners ?? [])
    } catch (err: any) {
      setError(err.message)
      setOwners([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const createOwner = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/nhome/owners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to create owner')
      await reload()
      return data.owner as Owner
    },
    [reload]
  )

  const updateOwner = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/nhome/owners/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to update owner')
      await reload()
      return data.owner as Owner
    },
    [reload]
  )

  const deleteOwner = useCallback(
    async (id: string) => {
      const res = await fetch('/api/nhome/owners/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete owner')
      await reload()
    },
    [reload]
  )

  const assignApartment = useCallback(
    async (apartment_id: string, owner_id: string | null) => {
      const res = await fetch('/api/nhome/owners/assign-apartment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartment_id, owner_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign apartment')
      await reload()
    },
    [reload]
  )

  const createApartmentForOwner = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/nhome/apartments/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Failed to create apartment')
      await reload()
      return data.apartment
    },
    [reload]
  )

  return {
    owners,
    loading,
    error,
    reload,
    createOwner,
    updateOwner,
    deleteOwner,
    assignApartment,
    createApartmentForOwner,
  }
}
