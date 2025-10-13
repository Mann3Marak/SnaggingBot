'use client'
import Link from 'next/link'
import { useAuthUser } from '@/hooks/useAuthUser'
import { SignOutButton } from './SignOutButton'

const pillClasses = 'inline-flex items-center justify-center rounded-full border border-white/60 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function AuthStatus() {
  const { user, loading } = useAuthUser()

  if (loading) {
    return (
      <span className={`${pillClasses} cursor-default text-white/70 hover:border-white/60 hover:bg-white/10`}>
        Checking access...
      </span>
    )
  }

  if (user) {
    return (
      <SignOutButton className={`${pillClasses} hover:text-white`}>
        Sign out
      </SignOutButton>
    )
  }

  return (
    <Link href='/auth/signin' className={pillClasses}>
      Sign in to NHome
    </Link>
  )
}
