import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureEnv } from '@/lib/env'

export async function POST(request: NextRequest) {
  const validation = ensureEnv('NHome profile bootstrap', ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message, missing: validation.missing }, { status: 500 })
  }

  try {
    const { userId, email, fullName, role } = await request.json()
    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const derivedName =
      typeof fullName === 'string' && fullName.trim().length > 0
        ? fullName.trim()
        : email.split('@')[0]?.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    const profilePayload = {
      id: userId,
      email,
      full_name: derivedName ?? email,
      role: role ?? 'inspector',
    }

    const { error } = await supabase.from('users').upsert(profilePayload, { onConflict: 'id' })
    if (error) {
      console.error('Failed to bootstrap NHome profile', error)
      return NextResponse.json({ error: 'Failed to bootstrap NHome profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected bootstrap profile error', error)
    return NextResponse.json({ error: error?.message ?? 'Unexpected server error' }, { status: 500 })
  }
}
