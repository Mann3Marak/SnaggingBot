import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabase() {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'public' },
      isSingleton: true,
    })
  }
  return client
}
