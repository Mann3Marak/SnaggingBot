import Link from 'next/link'
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
      <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-nhome-foreground'>Welcome to NHome Dashboard</h1>
          <p className='mt-1 text-slate-600'>Launch inspections, review progress, and hand off client-ready reports.</p>
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
        <h2 className='text-lg font-semibold text-nhome-foreground'>Quick actions</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <Link
            href='/inspection/start'
            className='flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
          >
            <div>
              <p className='text-sm font-semibold uppercase tracking-wide text-nhome-secondary'>Start</p>
              <h3 className='mt-1 text-lg font-semibold text-nhome-primary'>New inspection session</h3>
              <p className='mt-2 text-sm text-slate-600'>Run the guided NHome intake to pick a project, apartment, and voice workflow.</p>
            </div>
            <span className='mt-4 text-sm font-semibold text-nhome-primary'>Open workflow ?</span>
          </Link>

          <Link
            href='/voice/test'
            className='flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
          >
            <div>
              <p className='text-sm font-semibold uppercase tracking-wide text-nhome-secondary'>Voice</p>
              <h3 className='mt-1 text-lg font-semibold text-nhome-foreground'>Test inspection assistant</h3>
              <p className='mt-2 text-sm text-slate-600'>Warm up with the NHome voice assistant before heading onsite.</p>
            </div>
            <span className='mt-4 text-sm font-semibold text-nhome-primary'>Launch voice lab ?</span>
          </Link>

          <Link
            href='/auth/signin?message=Connect%20Microsoft%20to%20sync%20OneDrive'
            className='flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md'
          >
            <div>
              <p className='text-sm font-semibold uppercase tracking-wide text-nhome-secondary'>Sync</p>
              <h3 className='mt-1 text-lg font-semibold text-nhome-foreground'>Connect OneDrive</h3>
              <p className='mt-2 text-sm text-slate-600'>Ensure Microsoft login is active so inspection photos and reports upload instantly.</p>
            </div>
            <span className='mt-4 text-sm font-semibold text-nhome-primary'>Review connection ?</span>
          </Link>
        </div>
      </section>

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
            <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm'>
              <h3 className='text-lg font-semibold text-nhome-foreground'>No projects yet</h3>
              <p className='mt-2 text-sm text-slate-600'>Launch your first inspection to create a project record automatically.</p>
              <Link
                href='/inspection/start'
                className='mt-4 inline-flex items-center rounded-full bg-nhome-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-nhome-primary-dark'
              >
                Start first inspection
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
