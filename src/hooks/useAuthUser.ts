'use client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

type AuthUserState = {
  user: User | null
  loading: boolean
}

export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ user: null, loading: true })

  useEffect(() => {
    const supabase = getSupabase()

    supabase.auth.getUser().then(({ data }) => {
      setState({ user: data?.user ?? null, loading: false })
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false })
    })

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  return state
}
