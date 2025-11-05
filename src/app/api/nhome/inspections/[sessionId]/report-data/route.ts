export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET_ID = 'nhome_photos'

const stripQuery = (value: string) => value.split('?')[0]

function resolveStoragePath(sessionId: string, fileName: string, storedPath?: string | null) {
  if (!storedPath) return `sessions/${sessionId}/${fileName}`
  if (storedPath.startsWith('sessions/')) return stripQuery(storedPath)

  const marker = '/nhome_photos/'
  const index = storedPath.indexOf(marker)
  if (index >= 0) {
    return stripQuery(storedPath.slice(index + marker.length))
  }
  return stripQuery(storedPath)
}

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = params.sessionId
  try {
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    console.log("🧩 Report Data API called with sessionId:", sessionId);

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
      .select('*, checklist_templates:item_id(id, room_type, room_type_pt, item_description, item_description_pt), inspection_results_pt:inspection_results_pt(enhanced_notes_pt)')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (resultsError) {
      return NextResponse.json(
        { error: 'Failed to load results', detail: resultsError.message },
        { status: 500 },
      )
    }

    // 4) Load photos linked to this session and generate signed URLs
    const { data: photoRows, error: photosError } = await supabase
      .from('nhome_photos')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (photosError) {
      return NextResponse.json(
        { error: 'Failed to load photos', detail: photosError.message },
        { status: 500 },
      )
    }

    const photos = photoRows ?? []
    console.log(`📸 Found ${photos.length} persisted photos for session ${sessionId}`)

    const signedPhotos = await Promise.all(
      photos.map(async (photo) => {
        const fileName = photo.file_name ?? `photo-${photo.id}.jpg`
        const storagePath = resolveStoragePath(sessionId, fileName, photo.supabase_url)

        const { data: signed, error: signedError } = await supabase.storage
          .from(BUCKET_ID)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7)

        if (signedError) {
          console.warn('[ReportData] Unable to sign photo URL', {
            sessionId,
            storagePath,
            error: signedError.message,
          })
        }

        return {
          ...photo,
          storage_path: storagePath,
          signed_url: signed?.signedUrl ?? null,
        }
      })
    )

    const photosByKey = new Map<string, any[]>()
    signedPhotos.forEach((photo) => {
      if (!photo.item_id) return
      const key = String(photo.item_id)
      if (!key || key === "undefined" || key === "null") return
      const bucket = photosByKey.get(key) ?? []
      bucket.push(photo)
      photosByKey.set(key, bucket)
    })

    const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL
    const resultsWithPhotos = (results ?? []).map(r => {
      const resultKey = String(r.id)
      const checklistKey = String(r.item_id)
      const linked =
        photosByKey.get(resultKey) ??
        photosByKey.get(checklistKey) ??
        []

      const preview_photos = linked.map((photo: any) => {
        const fallbackUrl = publicBase
          ? `${publicBase}/storage/v1/object/public/${BUCKET_ID}/${photo.storage_path}`
          : null
        return {
          url: photo.signed_url ?? fallbackUrl,
          metadata: {
            file_name: photo.file_name,
            created_at: photo.created_at,
            inspector: photo.inspector_name ?? 'NHome Inspector',
          },
        }
      })

      return {
        ...r,
        preview_photos,
      }
    })

    // Helper to sanitize text fields and remove corrupted characters
    const clean = (s: any) =>
      typeof s === 'string' ? s.replace(/[^\x20-\x7EÀ-ÿ–—]/g, '-') : s

    // Shape expected by NHomeReportGenerationService
    const payload = {
      session,
      apartment: {
        ...apartment,
        apartment_type: clean(apartment.apartment_type),
        unit_number: clean(apartment.unit_number),
      },
      project: {
        ...apartment.projects,
        name: clean(apartment.projects?.name),
        developer_name: clean(apartment.projects?.developer_name),
      },
      client: {
        name: clean(`${apartment.client_name ?? ''} ${apartment.client_surname ?? ''}`.trim()),
      },
      results: resultsWithPhotos.map(r => ({
        ...r,
        checklist_templates: {
          ...r.checklist_templates,
          item_description: clean(r.checklist_templates?.item_description),
          room_type: clean(r.checklist_templates?.room_type),
        },
        notes: clean(r.enhanced_notes || r.notes),
      })),
      photos: signedPhotos,
      inspector: null,
      company_info: {
        name: '',
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
