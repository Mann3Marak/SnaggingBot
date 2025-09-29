import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = params.sessionId
  try {
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Use service role client to bypass RLS for report generation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service role key or URL not configured" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 1) Load the inspection session
    const { data: session, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or not accessible', detail: sessionError?.message },
        { status: 404 },
      )
    }

    // 2) Load apartment + project in separate, unambiguous queries
    const { data: apartment, error: aptError } = await supabase
      .from('apartments')
      .select('*, projects(*)')
      .eq('id', session.apartment_id)
      .maybeSingle()

    if (aptError || !apartment) {
      return NextResponse.json(
        { error: 'Apartment not found for session', detail: aptError?.message },
        { status: 404 },
      )
    }

    // 3) Load results joined with checklist templates for item metadata
    const { data: results, error: resultsError } = await supabase
      .from('inspection_results')
      .select('*, checklist_templates:item_id(*)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (resultsError) {
      return NextResponse.json(
        { error: 'Failed to load results', detail: resultsError.message },
        { status: 500 },
      )
    }

    // 4) Load photos linked to this session
    const { data: photos, error: photosError } = await supabase
      .from('nhome_inspection_photos')
      .select('*')
      .eq('session_id', sessionId)

    if (photosError) {
      return NextResponse.json(
        { error: 'Failed to load photos', detail: photosError.message },
        { status: 500 },
      )
    }

    // Merge photo_urls from results with nhome_inspection_photos
    const resultsWithPhotos = (results ?? []).map(r => {
      const linked = photos.filter(p => p.item_id === r.item_id)
      if (linked.length > 0) {
        return { ...r, preview_photos: linked.map(p => ({ url: p.onedrive_url })) }
      }
      if (r.photo_urls && r.photo_urls.length > 0) {
        return { ...r, preview_photos: r.photo_urls.map((u: string) => ({ url: u })) }
      }
      return { ...r, preview_photos: [] }
    })

    // Shape expected by NHomeReportGenerationService
    const payload = {
      session,
      apartment,
      project: apartment.projects,
      developer: { name: apartment.projects?.developer_name },
      results: resultsWithPhotos,
      photos,
      inspector: null,
      company_info: {
        name: 'NHome Property Setup & Management',
        founder: "Natalie O'Kelly",
        location: 'Algarve, Portugal',
        website: 'https://www.nhomesetup.com',
        tagline: 'Your Property Setup and Management Partner in the Algarve',
        email: 'info@nhomesetup.com',
        established: '2018',
      },
    }

    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ error: 'Unexpected server error', detail: e?.message }, { status: 500 })
  }
}
