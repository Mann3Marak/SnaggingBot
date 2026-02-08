import { NextRequest, NextResponse } from 'next/server'
import { requireOwnership, createServiceClient } from '@/lib/server/apiAuth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, portugueseUrl, englishUrl, photoPackageUrl } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Verify user owns the session or is admin
    const { user } = await requireOwnership(req, {
      type: 'session',
      resourceId: sessionId,
    })

    console.info('[Save Reports] Saving report URLs', {
      sessionId,
      userId: user.id,
      hasPortuguese: !!portugueseUrl,
      hasEnglish: !!englishUrl,
      hasPhotoPackage: !!photoPackageUrl,
    })

    // Use service role to update session (RLS might block updates)
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    })

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
      console.error('[Save Reports] Failed to save report URLs', {
        error: error.message,
        sessionId,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Failed to save reports', detail: error.message }, { status: 500 })
    }

    console.info('[Save Reports] Report URLs saved successfully', {
      sessionId,
      userId: user.id,
    });

    // After saving reports, trigger translation for any missing pt_notes
    try {
      const { data: results } = await supabase
        .from("inspection_results")
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
    } catch (err: any) {
      console.warn('[Save Reports] Translation trigger failed', {
        error: err.message,
        sessionId,
        userId: user.id,
      });
    }

    return NextResponse.json({ success: true, session: data })
  } catch (e: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (e instanceof NextResponse) {
      return e;
    }

    console.error('[Save Reports] Unexpected error', {
      error: e?.message,
    });
    return NextResponse.json({ error: 'Unexpected server error', detail: e?.message }, { status: 500 })
  }
}
