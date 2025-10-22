import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import AddApartmentCard from '@/components/dashboard/AddApartmentCard'
import StartInspectionCard from '@/components/dashboard/StartInspectionCard'

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
  let followUpInspections: any[] = []
  try {
    const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const svc = svcUrl && svcKey
      ? createSupabaseClient(svcUrl!, svcKey!, { auth: { persistSession: false } })
      : supabase

    // Fetch all inspection sessions
    const { data: allSessions, error: sessionsError } = await svc
      .from('inspection_sessions')
      .select('id, status, started_at, completed_at, inspector_id, apartment_id')
      .order('started_at', { ascending: false })
      .limit(50);

    if (sessionsError) throw sessionsError;

    const sessions = allSessions || [];
    const apartmentIds = Array.from(new Set(sessions.map((s) => s.apartment_id).filter(Boolean)));
    let apartmentMap = new Map<string, any>();
    if (apartmentIds.length > 0) {
      const { data: apartmentsData, error: apartmentsError } = await svc
        .from('apartments')
        .select('id, unit_number, apartment_type, projects(id, name, developer_name)')
        .in('id', apartmentIds);
      if (apartmentsError) throw apartmentsError;
      apartmentMap = new Map((apartmentsData || []).map((apt) => [apt.id, apt]));
    }

    // Split sessions by status
    const enriched = sessions.map((s) => ({
      ...s,
      apartment: apartmentMap.get(s.apartment_id) || null,
    }));

    inProgress = enriched.filter((s) => s.status === 'in_progress');
    followUpInspections = enriched.filter((s) => s.status === 'completed');
  } catch (e: any) {
    inProgress = []
    followUpInspections = []
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
          <div>
            <StartInspectionCard />
          </div>
          {/* Add Apartment Quick Action */}
          <div>
            <AddApartmentCard />
          </div>
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

      {/* Follow-up Inspections Section */}
      <section>
        <h2 className='text-lg font-semibold text-nhome-foreground mt-8'>Follow-up Inspections</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {followUpInspections.length > 0 ? (
            followUpInspections.map((s) => {
              const apt = (s as any).apartment
              const proj = apt?.projects
              return (
                <a
                  key={s.id}
                  href={`/inspection/follow-up?sessionId=${s.id}`}
                  className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition block'
                >
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
                    Completed {s.completed_at ? new Date(s.completed_at).toLocaleString() : 'Unknown'}
                  </p>
                  <span className='mt-3 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'>
                    Needs Follow-up
                  </span>
                </a>
              )
            })
          ) : (
            <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center'>
              <p className='text-sm text-slate-600 mb-3'>No inspections require follow-up.</p>
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
