import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import dynamicImport from 'next/dynamic'
const NHomeAdminDashboard = dynamicImport(() => import('@/components/admin/NHomeAdminDashboard'), { ssr: false })
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
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
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { data: me } = await supabase.from('users').select('role').eq('id', session?.user.id).maybeSingle()

  if (!session || (me && me.role !== 'admin')) {
    return (
      <main className="p-8">
        <div className="max-w-xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h1 className="text-xl font-semibold mb-2">Restricted</h1>
          <p>You must be signed in as an admin to view the NHome Business Dashboard.</p>
        </div>
      </main>
    )
  }

  return (
    <main>
      <NHomeAdminDashboard />
    </main>
  )
}
