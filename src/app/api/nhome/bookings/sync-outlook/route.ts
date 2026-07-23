import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getActor } from '@/lib/server/supabase-admin'
import {
  isOutlookConfigured,
  buildStayEvent,
  buildBookingEventPayload,
  createGraphEvent,
  updateGraphEvent,
  deleteGraphEvent,
} from '@/lib/server/outlook-sync'
import type { Booking } from '@/lib/bookings'

// POST /api/nhome/bookings/sync-outlook { bookingId }
// Outbound push (Sprint 6a): create/update the Outlook events for a booking's stay
// and each of its events, storing the returned Graph ids for later reconciliation.
export async function POST(req: NextRequest) {
  try {
    if (!isOutlookConfigured()) {
      return NextResponse.json(
        {
          error: 'Outlook is not configured',
          detail:
            'Set NHOME_OUTLOOK_USER (and optionally NHOME_OUTLOOK_CALENDAR_ID) and grant Calendars.ReadWrite application permission.',
        },
        { status: 400 }
      )
    }

    const { bookingId } = (await req.json()) ?? {}
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const actor = await getActor()

    const { data, error } = await supabase
      .from('bookings')
      .select(
        `id, apartment_id, guest_name, arrival_date, departure_date, budget, notes, status, outlook_event_id,
         apartment:apartments(id, unit_number, apartment_type, building_number),
         events:booking_events(id, booking_id, event_type, event_date, event_time, title, notes, outlook_event_id, outlook_synced_at)`
      )
      .eq('id', bookingId)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    const booking = data as unknown as Booking

    const now = new Date().toISOString()
    const cancelled = booking.status === 'cancelled'

    // --- Stay event ---
    if (cancelled && booking.outlook_event_id) {
      await deleteGraphEvent(booking.outlook_event_id)
      await supabase
        .from('bookings')
        .update({ outlook_event_id: null, outlook_synced_at: now })
        .eq('id', booking.id)
    } else if (!cancelled && booking.arrival_date && booking.departure_date) {
      const payload = buildStayEvent(booking)
      if (booking.outlook_event_id) {
        await updateGraphEvent(booking.outlook_event_id, payload)
        await supabase.from('bookings').update({ outlook_synced_at: now }).eq('id', booking.id)
      } else {
        const created = await createGraphEvent(payload)
        await supabase
          .from('bookings')
          .update({ outlook_event_id: created.id, outlook_synced_at: now })
          .eq('id', booking.id)
      }
    }

    // --- Individual events ---
    const results: { eventId: string; outlookId: string | null }[] = []
    for (const ev of booking.events ?? []) {
      if (cancelled) {
        if (ev.outlook_event_id) await deleteGraphEvent(ev.outlook_event_id)
        await supabase
          .from('booking_events')
          .update({ outlook_event_id: null, outlook_synced_at: now })
          .eq('id', ev.id)
        results.push({ eventId: ev.id, outlookId: null })
        continue
      }
      const payload = buildBookingEventPayload(booking, ev)
      if (ev.outlook_event_id) {
        await updateGraphEvent(ev.outlook_event_id, payload)
        await supabase.from('booking_events').update({ outlook_synced_at: now }).eq('id', ev.id)
        results.push({ eventId: ev.id, outlookId: ev.outlook_event_id })
      } else {
        const created = await createGraphEvent(payload)
        await supabase
          .from('booking_events')
          .update({ outlook_event_id: created.id, outlook_synced_at: now })
          .eq('id', ev.id)
        results.push({ eventId: ev.id, outlookId: created.id })
      }
    }

    await supabase.from('booking_audit').insert([
      {
        booking_id: booking.id,
        action: 'synced_outlook',
        actor_id: actor.id,
        actor_email: actor.email,
        changes: { direction: 'outbound', cancelled, results },
      },
    ])

    return NextResponse.json({ message: 'Synced to Outlook', synced_at: now, results })
  } catch (err: any) {
    console.error('Error syncing booking to Outlook:', err)
    return NextResponse.json(
      { error: 'Failed to sync to Outlook', detail: err?.message },
      { status: 500 }
    )
  }
}
