import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'
import { getGraphEvent } from '@/lib/server/outlook-sync'

// Microsoft Graph change-notification endpoint (Sprint 6b — inbound Outlook → app).
//
// Graph calls this URL:
//   1. During subscription creation with ?validationToken=... — we must echo it back
//      as text/plain within 10s.
//   2. On calendar changes with a JSON body of notifications. We match each changed
//      event to a booking_event by the stored outlook_event_id and reconcile
//      (last-write-wins) the date/time back into our database.
//
// NOTE: requires a public HTTPS URL and an active subscription, so it cannot be
// exercised from localhost. The handler itself is complete and idempotent.

export async function POST(req: NextRequest) {
  // Handshake: Graph sends validationToken as a query param.
  const validationToken = req.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const notifications: any[] = body?.value ?? []
  const expectedClientState = process.env.NHOME_OUTLOOK_CLIENT_STATE

  // Acknowledge quickly; process what we can. Graph retries on non-2xx.
  const supabase = getServiceClient()

  await Promise.all(
    notifications.map(async (n) => {
      try {
        if (expectedClientState && n.clientState && n.clientState !== expectedClientState) {
          return // ignore spoofed notifications
        }
        const outlookId: string | undefined = n?.resourceData?.id
        if (!outlookId) return

        const { data: match } = await supabase
          .from('booking_events')
          .select('id, booking_id, event_date, event_time')
          .eq('outlook_event_id', outlookId)
          .maybeSingle()
        if (!match) return

        if (n.changeType === 'deleted') {
          await supabase
            .from('booking_events')
            .update({ outlook_event_id: null, outlook_synced_at: new Date().toISOString() })
            .eq('id', match.id)
          await recordInbound(supabase, match.booking_id, {
            outlookId,
            change: 'deleted',
          })
          return
        }

        // created/updated → pull the event and reconcile the schedule.
        const event = await getGraphEvent(outlookId)
        const start: string | undefined = event?.start?.dateTime
        if (!start) return
        const [datePart, timePart] = start.split('T')
        const newTime = timePart ? timePart.slice(0, 5) : null

        await supabase
          .from('booking_events')
          .update({
            event_date: datePart,
            event_time: newTime,
            outlook_synced_at: new Date().toISOString(),
          })
          .eq('id', match.id)

        await recordInbound(supabase, match.booking_id, {
          outlookId,
          change: n.changeType,
          from: { date: match.event_date, time: match.event_time },
          to: { date: datePart, time: newTime },
        })
      } catch (err) {
        console.error('Error processing Outlook notification:', err)
      }
    })
  )

  return NextResponse.json({ ok: true })
}

async function recordInbound(
  supabase: ReturnType<typeof getServiceClient>,
  bookingId: string | null,
  changes: Record<string, unknown>
) {
  await supabase.from('booking_audit').insert([
    {
      booking_id: bookingId,
      action: 'synced_outlook',
      actor_email: 'outlook',
      changes: { direction: 'inbound', ...changes },
    },
  ])
}
