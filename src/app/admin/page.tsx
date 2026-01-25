import AdminQuickActions from '@/components/admin/AdminQuickActions'
import { requireAuth } from '@/lib/server/requireAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AdminPage() {
  // Server-side authentication guard
  const { session, supabase } = await requireAuth('/admin')

  const { data: me } = await supabase
    .from('users')
    .select('email, full_name, role')
    .eq('id', session.user.id)
    .maybeSingle()

  // If not admin, show access denied
  if (me?.role !== 'admin') {
    return (
      <main className='p-6'>
        <div className='rounded-2xl border border-red-200 bg-red-50 p-6 text-center'>
          <h1 className='text-xl font-semibold text-red-800'>Access Denied</h1>
          <p className='mt-2 text-sm text-red-600'>
            You do not have permission to access the admin area.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className='p-6 space-y-8'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-nhome-foreground'>Admin Dashboard</h1>
          <p className='mt-1 text-slate-600'>Manage inspections, users, and reports.</p>
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

      {/* Client-side Admin Actions Section */}
      <AdminQuickActions />
    </main>
  )
}
