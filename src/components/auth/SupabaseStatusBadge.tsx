"use client"
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface Props {
  className?: string
}

export function SupabaseStatusBadge({ className }: Props) {
  const [status, setStatus] = useState<'loading' | 'signed_in' | 'signed_out'>('loading')
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    let mounted = true
    const supabase = getSupabase()

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const sess = data.session
      if (sess?.user) {
        setStatus('signed_in')
        setEmail(sess.user.email || '')
      } else {
        setStatus('signed_out')
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return
      if (session?.user) {
        setStatus('signed_in')
        setEmail(session.user.email || '')
      } else {
        setStatus('signed_out')
        setEmail('')
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border'
  if (status === 'loading') {
    return (
      <span className={`${base} border-gray-300 text-gray-600 bg-white ${className || ''}`}>
        <span className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
        Checking Supabase…
      </span>
    )
  }
  if (status === 'signed_in') {
    return (
      <span className={`${base} border-emerald-300 text-emerald-700 bg-emerald-50 ${className || ''}`} title={email}>
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        Supabase: signed in{email ? ` (${email})` : ''}
      </span>
    )
  }
  return (
    <a
      href="/auth/signin"
      className={`${base} border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition ${className || ''}`}
      title="Sign in to enable Supabase RLS access for report generation"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
      Supabase: not signed in
    </a>
  )
}

