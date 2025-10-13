import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
  const visibleProjects = projects ?? []

  let inProgress: any[] = []
  try {
    const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const svc = svcUrl && svcKey
      ? createSupabaseClient(svcUrl!, svcKey!, { auth: { persistSession: false } })
      : supabase

    const base = svc
      .from('inspection_sessions')
      .select('id, status, started_at, inspector_id, apartment_id')
      .neq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(24)

    let query = base
    if (session?.user?.id && me?.role !== 'admin') {
      query = query.eq('inspector_id', session.user.id)
    }

    const { data: sessionsData, error: sessionsError } = await query
    if (sessionsError) throw sessionsError

    const sessions = sessionsData || []
    const apartmentIds = Array.from(new Set(sessions.map((s) => s.apartment_id).filter(Boolean)))
    let apartmentMap = new Map<string, any>()
    if (apartmentIds.length > 0) {
      const { data: apartmentsData, error: apartmentsError } = await svc
        .from('apartments')
        .select('id, unit_number, apartment_type, projects(id, name, developer_name)')
        .in('id', apartmentIds)
      if (apartmentsError) throw apartmentsError
      apartmentMap = new Map((apartmentsData || []).map((apt) => [apt.id, apt]))
    }

    inProgress = sessions.map((s) => ({
      ...s,
      apartment: apartmentMap.get(s.apartment_id) || null,
    }))
  } catch (e: any) {
    inProgress = []
  }

  return (
    <main className='p-6 space-y-8'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-nhome-foreground'>Welcome to NHome Dashboard</h1>
          <p className='mt-1 text-slate-600'>Your Algarve inspections at a glance.</p>
        </div>
        <div className='text-right'>
          {me && (
            <div className='text-sm'>
              <p className='font-medium text-nhome-foreground'>{me.full_name ?? me.email}</p>
              <p className='text-slate-500 capitalize'>{me.role}</p>
            </div>
          )}
        </div>
      </header>

      <section>
        <h2 className='text-lg font-semibold text-nhome-foreground'>Quick Actions</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <a href="/inspection/start" className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition'>
            <h3 className='font-semibold text-nhome-primary'>Start New Inspection</h3>
            <p className='text-sm text-slate-600 mt-1'>Launch a guided inspection workflow</p>
          </a>
        </div>
      </section>

      <section>
        <h2 className='text-lg font-semibold text-nhome-foreground mt-8'>In-progress inspections</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {inProgress.map((s) => {
            const apt = (s as any).apartment
            const proj = apt?.projects
            return (
              <a key={s.id} href={`/inspection/nhome/${s.id}`} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition block'>
                <div className='text-xs uppercase tracking-wide text-slate-500 mb-1'>
                  {proj?.developer_name}
                </div>
                <h3 className='font-semibold text-nhome-primary'>
                  {proj?.name}
                </h3>
                <p className='text-sm text-slate-700 mt-1'>
                  Unit {apt?.unit_number} - {apt?.apartment_type}
                </p>
                <p className='text-xs text-slate-500 mt-2'>
                  Started {new Date(s.started_at).toLocaleString()}
                </p>
                <span className='mt-3 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800'>
                  {(s.status || 'in_progress').replace('_', ' ')}
                </span>
              </a>
            )
          })}

          {inProgress.length === 0 && (
            <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center'>
              <p className='text-sm text-slate-600 mb-3'>No inspections in progress.</p>
              <a href='/inspection/start' className='inline-block rounded-lg bg-nhome-primary px-4 py-2 text-white font-medium hover:bg-nhome-secondary transition'>
                Start a new inspection
              </a>
            </div>
          )}
        </div>
      </section>

      {visibleProjects.length > 0 && (
        <section>
          <h2 className='text-lg font-semibold text-nhome-foreground mt-8'>Recent projects</h2>
          <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {visibleProjects.map((p) => (
              <article key={p.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                <h3 className='font-semibold text-nhome-primary'>{p.name}</h3>
                <p className='text-sm text-slate-600'>{p.address}</p>
                <p className='mt-1 text-xs text-slate-500'>Developer: {p.developer_name}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

