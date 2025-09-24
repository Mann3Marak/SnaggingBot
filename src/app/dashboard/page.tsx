import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { SignOutButton } from '@/components/auth/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
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
    data: { session },
  } = await supabase.auth.getSession()

  const { data: me } = await supabase
    .from('users')
    .select('email, full_name, role')
    .eq('id', session?.user.id)
    .maybeSingle()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, address, developer_name')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <main className='p-6 space-y-8'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-nhome-foreground'>Welcome to NHome Dashboard</h1>
          <p className='mt-1 text-slate-600'>Your Algarve inspections at a glance.</p>
        </div>
        <div className='text-right'>
          {me ? (
            <div className='text-sm'>
              <p className='font-medium text-nhome-foreground'>{me.full_name ?? me.email}</p>
              <p className='text-slate-500 capitalize'>{me.role}</p>
            </div>
          ) : null}
          <div className='mt-2'>
            <SignOutButton />
          </div>
        </div>
      </header>

      <section>
        <h2 className='text-lg font-semibold text-nhome-foreground'>Recent projects</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {(projects ?? []).map((p) => (
            <article key={p.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
              <h3 className='font-semibold text-nhome-primary'>{p.name}</h3>
              <p className='text-sm text-slate-600'>{p.address}</p>
              <p className='mt-1 text-xs text-slate-500'>Developer: {p.developer_name}</p>
            </article>
          ))}
          {projects?.length === 0 && (
            <p className='text-sm text-slate-600'>No projects yet. Create one to begin inspections.</p>
          )}
        </div>
      </section>
    </main>
  )
}
