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
        <h2 className='text-lg font-semibold text-nhome-foreground'>Quick Actions</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <a href="/inspection/start" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <h3 className="font-semibold text-nhome-primary">Start New Inspection</h3>
            <p className="text-sm text-slate-600 mt-1">Launch a guided inspection workflow</p>
          </a>
          {/* Hidden for this release
          <a href="/inspection/nhome-photos" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <h3 className="font-semibold text-nhome-primary">Upload Photos</h3>
            <p className="text-sm text-slate-600 mt-1">Capture or upload inspection photos</p>
          </a>
          <a href="/voice/test" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <h3 className="font-semibold text-nhome-primary">Start Voice Inspection</h3>
            <p className="text-sm text-slate-600 mt-1">Use voice assistant for inspections</p>
          </a>
          */}
        </div>
      </section>

      <section>
        <h2 className='text-lg font-semibold text-nhome-foreground mt-8'>Recent projects</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {(projects ?? []).map((p) => (
            <article key={p.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
              <h3 className='font-semibold text-nhome-primary'>{p.name}</h3>
              <p className='text-sm text-slate-600'>{p.address}</p>
              <p className='mt-1 text-xs text-slate-500'>Developer: {p.developer_name}</p>
            </article>
          ))}
          {projects?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600 mb-3">No projects yet.</p>
              <a href="/inspection/start" className="inline-block rounded-lg bg-nhome-primary px-4 py-2 text-white font-medium hover:bg-nhome-secondary transition">
                Start your first inspection
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
