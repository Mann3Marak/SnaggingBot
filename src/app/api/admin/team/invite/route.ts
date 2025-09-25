import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email, name, role = 'inspector' } = await req.json()

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return NextResponse.json({ error: 'Server missing Supabase configuration' }, { status: 500 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: me, error: meError } = await supabase
      .from('users')
      .select('role, company_id, full_name')
      .eq('id', session.user.id)
      .maybeSingle()

    if (meError || !me) {
      return NextResponse.json({ error: 'Unable to verify admin profile' }, { status: 403 })
    }

    if (me.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 })
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    let userId: string | undefined
    let inviteError: any
    try {
      const redirectTo = process.env.NHOME_INVITE_REDIRECT ?? `${req.nextUrl.origin}/auth/signin`
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
        redirectTo,
      })
      if (error) throw error
      userId = data?.user?.id
    } catch (error) {
      inviteError = error
    }

    if (!userId) {
      const { data, error } = await adminClient.auth.admin.getUserByEmail(email)
      if (error || !data?.user) {
        const message = (inviteError as Error | undefined)?.message ?? 'Unable to invite user'
        return NextResponse.json({ error: message }, { status: 400 })
      }
      userId = data.user.id
    }

    const { error: upsertError } = await adminClient.from('users').upsert({
      id: userId,
      email,
      full_name: name,
      role,
      company_id: me.company_id,
    })

    if (upsertError) {
      console.error('Failed to sync user profile:', upsertError)
      return NextResponse.json({ error: 'Failed to sync team member profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Team invite error:', error)
    return NextResponse.json({ error: error?.message ?? 'Unexpected server error' }, { status: 500 })
  }
}
