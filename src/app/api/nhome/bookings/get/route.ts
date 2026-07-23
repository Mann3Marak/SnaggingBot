import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

// GET /api/nhome/bookings/get?id=  — single booking with events, apartment, and
// full audit history (requirement #4).
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `id, apartment_id, guest_name, arrival_date, departure_date, budget, notes, status, created_at, updated_at,
         apartment:apartments(id, unit_number, apartment_type, building_number),
         events:booking_events(id, booking_id, event_type, event_date, event_time, title, notes, outlook_event_id, outlook_synced_at)`
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching booking:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: audit } = await supabase
      .from('booking_audit')
      .select('id, booking_id, action, actor_id, actor_email, changes, created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ booking, audit: audit ?? [] }, { status: 200 })
  } catch (err: any) {
    console.error('Unexpected error fetching booking:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
