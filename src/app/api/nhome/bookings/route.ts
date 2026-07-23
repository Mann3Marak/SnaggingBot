import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getActor } from '@/lib/server/supabase-admin'
import { sanitizeEvents } from '@/lib/bookings'

// POST /api/nhome/bookings — create a booking with its typed events + audit entry.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      apartment_id,
      guest_name,
      arrival_date,
      departure_date,
      budget,
      notes,
      status,
      events,
    } = body ?? {}

    if (!arrival_date || !departure_date) {
      return NextResponse.json(
        { error: 'Arrival and departure dates are required' },
        { status: 400 }
      )
    }
    if (new Date(departure_date) < new Date(arrival_date)) {
      return NextResponse.json(
        { error: 'Departure date cannot be before arrival date' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()
    const actor = await getActor()

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          apartment_id: apartment_id || null,
          guest_name: guest_name || null,
          arrival_date,
          departure_date,
          budget: budget === '' || budget == null ? null : Number(budget),
          notes: notes || null,
          status: status || 'confirmed',
          created_by: actor.id,
        },
      ])
      .select()
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      return NextResponse.json(
        { error: 'Failed to create booking', detail: bookingError.message },
        { status: 500 }
      )
    }

    // Insert the manual events (deliveries / cleanings / inspections).
    const cleanEvents = sanitizeEvents(events, booking.id)
    if (cleanEvents.length > 0) {
      const { error: eventsError } = await supabase
        .from('booking_events')
        .insert(cleanEvents)
      if (eventsError) {
        console.error('Error creating booking events:', eventsError)
        // Booking exists; surface the partial failure rather than silently dropping.
        return NextResponse.json(
          {
            error: 'Booking created but events failed',
            detail: eventsError.message,
            booking,
          },
          { status: 207 }
        )
      }
    }

    await supabase.from('booking_audit').insert([
      {
        booking_id: booking.id,
        action: 'created',
        actor_id: actor.id,
        actor_email: actor.email,
        changes: { booking, events: cleanEvents },
      },
    ])

    return NextResponse.json({ message: 'Booking created', booking })
  } catch (err: any) {
    console.error('Unexpected error creating booking:', err)
    return NextResponse.json(
      { error: 'Unexpected server error', detail: err?.message },
      { status: 500 }
    )
  }
}
