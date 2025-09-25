import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, clientEmail, sharedBy } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const token = randomUUID()
    const sharePath = `/inspection/share/${token}`

    await supabase.from('nhome_sharing_log').insert({
      session_id: sessionId,
      client_email: clientEmail ?? null,
      share_url: sharePath,
      shared_by: sharedBy ?? 'NHome Inspection Pro',
    })

    return NextResponse.json({ success: true, shareUrl: sharePath, token })
  } catch (error: any) {
    console.error('Share creation error:', error)
    return NextResponse.json({ error: error?.message ?? 'Unexpected server error' }, { status: 500 })
  }
}
