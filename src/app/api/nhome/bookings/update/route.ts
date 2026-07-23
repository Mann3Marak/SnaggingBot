import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getActor } from '@/lib/server/supabase-admin'
import { sanitizeEvents } from '@/lib/bookings'

// POST /api/nhome/bookings/update — update a booking's fields and (optionally)
// replace its manual events. Records an audit entry with before/after.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      apartment_id,
      guest_name,
      arrival_date,
      departure_date,
      budget,
      notes,
      status,
      events,
    } = body ?? {}

    if (!id) {
      return NextResponse.json({ error: 'Missing booking id' }, { status: 400 })
    }
    if (arrival_date && departure_date && new Date(departure_date) < new Date(arrival_date)) {
      return NextResponse.json(
        { error: 'Departure date cannot be before arrival date' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()
    const actor = await getActor()

    const { data: before } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!before) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}
    if (apartment_id !== undefined) patch.apartment_id = apartment_id || null
    if (guest_name !== undefined) patch.guest_name = guest_name || null
    if (arrival_date !== undefined) patch.arrival_date = arrival_date
    if (departure_date !== undefined) patch.departure_date = departure_date
    if (budget !== undefined) patch.budget = budget === '' || budget == null ? null : Number(budget)
    if (notes !== undefined) patch.notes = notes || null
    if (status !== undefined) patch.status = status

    const { data: booking, error: updateError } = await supabase
      .from('bookings')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json(
        { error: 'Failed to update booking', detail: updateError.message },
        { status: 500 }
      )
    }

    // If events are provided, replace the manual event set for this booking.
    if (events !== undefined) {
      await supabase.from('booking_events').delete().eq('booking_id', id)
      const cleanEvents = sanitizeEvents(events, id)
      if (cleanEvents.length > 0) {
        const { error: eventsError } = await supabase
          .from('booking_events')
          .insert(cleanEvents)
        if (eventsError) {
          console.error('Error replacing booking events:', eventsError)
        }
      }
    }

    await supabase.from('booking_audit').insert([
      {
        booking_id: id,
        action: 'updated',
        actor_id: actor.id,
        actor_email: actor.email,
        changes: { before, after: booking, patch },
      },
    ])

    return NextResponse.json({ message: 'Booking updated', booking })
  } catch (err: any) {
    console.error('Unexpected error updating booking:', err)
    return NextResponse.json(
      { error: 'Unexpected server error', detail: err?.message },
      { status: 500 }
    )
  }
}
