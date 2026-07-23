import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getActor } from '@/lib/server/supabase-admin'

// POST /api/nhome/bookings/delete { id } — deletes a booking (events cascade).
// Writes an audit entry with booking_id nulled by the FK, keeping a record via changes.
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) ?? {}
    if (!id) {
      return NextResponse.json({ error: 'Missing booking id' }, { status: 400 })
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

    // Record the audit entry before deletion so we retain the snapshot.
    await supabase.from('booking_audit').insert([
      {
        booking_id: id,
        action: 'deleted',
        actor_id: actor.id,
        actor_email: actor.email,
        changes: { before },
      },
    ])

    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) {
      console.error('Error deleting booking:', error)
      return NextResponse.json(
        { error: 'Failed to delete booking', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Booking deleted' })
  } catch (err: any) {
    console.error('Unexpected error deleting booking:', err)
    return NextResponse.json(
      { error: 'Unexpected server error', detail: err?.message },
      { status: 500 }
    )
  }
}
