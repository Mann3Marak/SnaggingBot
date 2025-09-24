import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = params.sessionId
  try {
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const supabase = getSupabase()

    // 1) Load the inspection session
    const { data: session, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found', detail: sessionError?.message },
        { status: 404 },
      )
    }

    // 2) Load apartment + project in separate, unambiguous queries
    const { data: apartment, error: aptError } = await supabase
      .from('apartments')
      .select('*, projects(*)')
      .eq('id', session.apartment_id)
      .single()

    if (aptError || !apartment) {
      return NextResponse.json(
        { error: 'Apartment not found for session', detail: aptError?.message },
        { status: 404 },
      )
    }

    // 3) Load results joined with checklist templates for item metadata
    const { data: results, error: resultsError } = await supabase
      .from('inspection_results')
      .select('*, checklist_templates(*)')
      .eq('session_id', sessionId)

    if (resultsError) {
      return NextResponse.json(
        { error: 'Failed to load results', detail: resultsError.message },
        { status: 500 },
      )
    }

    // Photos are currently managed client-side (IndexedDB + OneDrive); return an empty array for report generation
    const photos: any[] = []

    // Shape expected by NHomeReportGenerationService
    const payload = {
      session,
      apartment,
      project: apartment.projects,
      developer: { name: apartment.projects?.developer_name },
      results: results ?? [],
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
