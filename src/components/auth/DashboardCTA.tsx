'use client'
import Link from 'next/link'
import { useAuthUser } from '@/hooks/useAuthUser'

const dashboardButtonClasses = 'rounded-full bg-white px-6 py-3 text-sm font-semibold text-nhome-primary shadow-sm transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function DashboardCTA() {
  const { user, loading } = useAuthUser()

  if (loading || !user) {
    return null
  }

  return (
    <Link href='/dashboard' className={dashboardButtonClasses}>
      Dashboard
    </Link>
  )
}
