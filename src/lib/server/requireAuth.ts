import { redirect } from 'next/navigation'
import { getSupabaseServer } from './supabaseServer'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

interface RequireAuthResult {
  session: Session
  supabase: SupabaseClient
}

/**
 * Server-side authentication guard.
 *
 * Call this at the top of any server component or route handler that requires authentication.
 * If no valid session exists, the user will be redirected to the sign-in page.
 *
 * @param currentPath - The current path, used for redirect after sign-in
 * @returns Object containing the authenticated session and Supabase client
 *
 * @example
 * ```typescript
 * export default async function DashboardPage() {
 *   const { session, supabase } = await requireAuth('/dashboard')
 *   // Now you can use session.user and supabase client
 * }
 * ```
 */
export async function requireAuth(currentPath: string): Promise<RequireAuthResult> {
  const supabase = getSupabaseServer()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    console.log('[requireAuth] No valid session found, redirecting to sign-in')

    // Build redirect URL with the current path as a parameter
    const redirectUrl = `/auth/signin?redirectedFrom=${encodeURIComponent(currentPath)}`
    redirect(redirectUrl)
  }

  console.log('[requireAuth] Valid session found for user:', session.user.id)

  return { session, supabase }
}
