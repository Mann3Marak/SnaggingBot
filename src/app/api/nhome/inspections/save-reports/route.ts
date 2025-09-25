import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      portugueseUrl,
      englishUrl,
      photoPackageUrl,
      company,
      generated_by: generatedBy,
    } = await req.json()

    if (!sessionId || !portugueseUrl || !englishUrl) {
      return NextResponse.json({ error: 'Missing required report URLs' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const updates: Record<string, unknown> = {
      report_url_pt: portugueseUrl,
      report_url_en: englishUrl,
      report_generated_at: new Date().toISOString(),
    }

    if (photoPackageUrl) {
      updates.photo_package_url = photoPackageUrl
    }

    const { error } = await supabase
      .from('inspection_sessions')
      .update(updates)
      .eq('id', sessionId)

    if (error) {
      console.error('Failed to persist report URLs:', error)
      return NextResponse.json({ error: 'Failed to persist report URLs' }, { status: 500 })
    }

    if (generatedBy || company) {
      await supabase.from('nhome_sharing_log').insert({
        session_id: sessionId,
        share_url: portugueseUrl,
        shared_by: generatedBy ?? 'NHome Inspection Pro',
        client_email: company ?? null,
      }).catch(() => undefined)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected save-reports error:', error)
    return NextResponse.json({ error: error?.message ?? 'Unexpected server error' }, { status: 500 })
  }
}
