'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { SignOutButton } from './SignOutButton'
import { NHomeAuthForm } from './NHomeAuthForm'

export function AuthStatus() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) return null

  return user ? <SignOutButton /> : <NHomeAuthForm />
}
