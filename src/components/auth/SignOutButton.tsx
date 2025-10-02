'use client'
import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type SignOutButtonProps = {
  className?: string
  children?: ReactNode
}

export function SignOutButton({ className, children }: SignOutButtonProps) {
  const router = useRouter()

  async function signOut() {
    await getSupabase().auth.signOut()
    router.replace('/auth/signin?message=Signed out')
  }

  const defaultClass = 'text-sm font-medium text-nhome-primary hover:text-nhome-secondary'

  return (
    <button type='button' onClick={signOut} className={className ?? defaultClass}>
      {children ?? 'Sign out'}
    </button>
  )
}
