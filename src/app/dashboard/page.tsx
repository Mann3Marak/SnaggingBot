import DashboardQuickActions from '@/components/dashboard/DashboardQuickActions'
import { requireAuth } from '@/lib/server/requireAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function DashboardPage() {
  // Server-side authentication guard
  const { session, supabase } = await requireAuth('/dashboard')

  const { data: me } = await supabase
    .from('users')
    .select('email, full_name, role')
    .eq('id', session.user.id)
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
    // Use the authenticated client so RLS enforces tenant/user isolation.
    const { data: allSessions, error: sessionsError } = await supabase
      .from('inspection_sessions')
      .select('id, status, started_at, completed_at, inspector_id, apartment_id')
      .order('started_at', { ascending: false })
      .limit(50);

    if (sessionsError) throw sessionsError;

    const sessions = allSessions || [];
    const apartmentIds = Array.from(new Set(sessions.map((s) => s.apartment_id).filter(Boolean)));
    let apartmentMap = new Map<string, any>();
    if (apartmentIds.length > 0) {
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('id, unit_number, apartment_type, client_name, client_surname, projects(id, name, developer_name)')
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

      {/* Client-side Quick Actions Section */}
      <DashboardQuickActions />

      <section>
        <h2 className='text-lg font-semibold text-nhome-foreground mt-8'>In-progress inspections</h2>
        <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {inProgress.map((s) => {
            const apt = (s as any).apartment
            const proj = apt?.projects
            const clientName = apt?.client_name && apt?.client_surname
              ? `${apt.client_name} ${apt.client_surname}`
              : apt?.client_name || apt?.client_surname || 'No Client Assigned'
            return (
              <a key={s.id} href={`/inspection/nhome/${s.id}`} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition block'>
                <h3 className='font-semibold text-nhome-primary'>
                  {proj?.name}
                </h3>
                <p className='text-sm text-slate-700 mt-1'>
                  Apartment: {apt?.unit_number} • Client: {clientName}
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
              const clientName = apt?.client_name && apt?.client_surname
                ? `${apt.client_name} ${apt.client_surname}`
                : apt?.client_name || apt?.client_surname || 'No Client Assigned'
              return (
                <a
                  key={s.id}
                  href={`/inspection/follow-up?sessionId=${s.id}`}
                  className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition block'
                >
                  <h3 className='font-semibold text-nhome-primary'>
                    {proj?.name}
                  </h3>
                  <p className='text-sm text-slate-700 mt-1'>
                    Apartment: {apt?.unit_number} • Client: {clientName}
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
