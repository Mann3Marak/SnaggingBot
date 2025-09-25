import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
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

    // Use server client with cookies so RLS sees the signed-in user
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      },
    )

    // 1) Load the inspection session
    let { data: session, error: sessionError } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()

    // If RLS blocks access (no auth cookies), optionally fall back to service role (server-only)
    if ((!session || sessionError) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const adminRes = await admin
        .from('inspection_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle()
      session = adminRes.data as any
      sessionError = adminRes.error as any
    }

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or not accessible', detail: sessionError?.message },
        { status: 404 },
      )
    }

    // 2) Load apartment + project in separate, unambiguous queries
    let { data: apartment, error: aptError } = await supabase
      .from('apartments')
      .select('*, projects(*)')
      .eq('id', session.apartment_id)
      .maybeSingle()

    if ((!apartment || aptError) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const adminRes = await admin
        .from('apartments')
        .select('*, projects(*)')
        .eq('id', session.apartment_id)
        .maybeSingle()
      apartment = adminRes.data as any
      aptError = adminRes.error as any
    }

    if (aptError || !apartment) {
      return NextResponse.json(
        { error: 'Apartment not found for session', detail: aptError?.message },
        { status: 404 },
      )
    }

    // 3) Load results joined with checklist templates for item metadata
    let { data: results, error: resultsError } = await supabase
      .from('inspection_results')
      .select('*, checklist_templates(*)')
      .eq('session_id', sessionId)

    if ((!results || resultsError) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const adminRes = await admin
        .from('inspection_results')
        .select('*, checklist_templates(*)')
        .eq('session_id', sessionId)
      results = adminRes.data as any
      resultsError = adminRes.error as any
    }

    if (resultsError) {
      return NextResponse.json(
        { error: 'Failed to load results', detail: resultsError.message },
        { status: 500 },
      )
    }

    let { data: photos, error: photosError } = await supabase
      .from('nhome_inspection_photos')
      .select('*')
      .eq('session_id', sessionId)
      .order('uploaded_at', { ascending: true })

    if ((!photos || photosError) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const adminRes = await admin
        .from('nhome_inspection_photos')
        .select('*')
        .eq('session_id', sessionId)
        .order('uploaded_at', { ascending: true })
      photos = adminRes.data as any
      photosError = adminRes.error as any
    }

    if (photosError) {
      return NextResponse.json(
        { error: 'Failed to load photos', detail: photosError.message },
        { status: 500 },
      )
    }
    // Shape expected by NHomeReportGenerationService
    const payload = {
      session,
      apartment,
      project: apartment.projects,
      developer: { name: apartment.projects?.developer_name },
      results: results ?? [],
      photos: photos ?? [],
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

