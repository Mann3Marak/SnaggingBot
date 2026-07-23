import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client (bypasses RLS). Mirrors the inline pattern used by
 * the existing nhome API routes, centralised so booking routes stay DRY.
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export type Actor = { id: string | null; email: string | null }

/**
 * Best-effort resolution of the signed-in user from the Supabase session cookie,
 * used to attribute booking audit entries. Never throws — returns nulls if there
 * is no session (routes still work, just with an anonymous actor).
 */
export async function getActor(): Promise<Actor> {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return { id: user?.id ?? null, email: user?.email ?? null }
  } catch {
    return { id: null, email: null }
  }
}
