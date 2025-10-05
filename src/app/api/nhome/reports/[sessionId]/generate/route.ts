import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToStream } from '@react-pdf/renderer'
import { NHomeReportDocument } from '@/components/reports/NHomeReportDocument'
import { getAccessToken, fetchOneDriveImageAsBase64 } from '@/lib/nhome-onedrive-utils'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = params.sessionId
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Fetch inspection data
    const { data: reportData, error } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()

    if (error || !reportData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch full report payload from existing route
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"

    const reportDataRes = await fetch(`${baseUrl}/api/nhome/inspections/${sessionId}/report-data`)
    const payload = await reportDataRes.json()

    // Fetch and embed OneDrive images as base64
    const accessToken = await getAccessToken()
    const resultsWithEmbeddedImages = await Promise.all(
      payload.results.map(async (r: any) => {
        // Try to extract readable item name and metadata
        // Try to extract readable item name and metadata
        const itemName =
          r.checklist_templates?.item_name ||
          r.checklist_templates?.title ||
          r.checklist_templates?.description ||
          r.checklist_templates?.label ||
          r.checklist_templates?.name ||
          r.item_name ||
          r.item_label ||
          r.item_title ||
          r.item_id

        const room = r.checklist_templates?.room || r.room || "N/A"
        const category = r.checklist_templates?.category || r.category || "N/A"

        // Embed images (try both OneDrive and Supabase public URLs)
        const embedded = await Promise.all(
          (r.preview_photos || []).map(async (p: any) => {
            try {
              if (p.url?.includes("public.supabase")) {
                // Directly fetch Supabase public image
                const res = await fetch(p.url)
                const buffer = await res.arrayBuffer()
                const base64 = Buffer.from(buffer).toString("base64")
                const contentType = res.headers.get("content-type") || "image/jpeg"
                return { ...p, base64: `data:${contentType};base64,${base64}` }
              } else {
                // Fetch from OneDrive using Graph API
                const base64 = await fetchOneDriveImageAsBase64(p.url, accessToken)
                return { ...p, base64 }
              }
            } catch (err) {
              console.warn("Image fetch failed for", p.url)
              return { ...p, base64: null }
            }
          })
        )

        return {
          ...r,
          item_name: itemName,
          room,
          category,
          preview_photos: embedded,
        }
      })
    )

    const finalPayload = { ...payload, results: resultsWithEmbeddedImages }

    // Render PDF
const pdfStream = await renderToStream(NHomeReportDocument({ data: finalPayload }))
    const response = new NextResponse(pdfStream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="nhome-report-${sessionId}.pdf"`,
      },
    })
    return response
  } catch (e: any) {
    console.error('Report generation failed:', e)
    return NextResponse.json({ error: 'Report generation failed', detail: e?.message }, { status: 500 })
  }
}
