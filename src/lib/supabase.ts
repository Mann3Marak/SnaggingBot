import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
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
