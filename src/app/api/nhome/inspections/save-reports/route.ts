import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { sessionId, portugueseUrl, englishUrl, photoPackageUrl } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Supabase service role key or URL not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('inspection_sessions')
      .update({
        report_url_pt: portugueseUrl ?? null,
        report_url_en: englishUrl ?? null,
        photo_package_url: photoPackageUrl ?? null,
        report_generated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select('*')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Failed to save reports', detail: error.message }, { status: 500 })
    }

    // After saving reports, trigger translation for any missing pt_notes
    try {
      const { data: results } = await supabase
        .from("nhome_inspection_results")
        .select("id, notes, pt_notes")
        .eq("session_id", sessionId)

      if (results && results.length > 0) {
        for (const r of results) {
          if (r.notes && !r.pt_notes) {
            await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/nhome/translate-notes`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ note: r.notes, resultId: r.id }),
            })
          }
        }
      }
    } catch (err) {
      console.error("Translation trigger failed:", err)
    }

    return NextResponse.json({ success: true, session: data })
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected server error', detail: e?.message }, { status: 500 })
  }
}
