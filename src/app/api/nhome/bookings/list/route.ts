import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

// GET /api/nhome/bookings/list?apartmentId=&from=&to=
// Returns bookings (optionally filtered) with their events + apartment hydrated,
// for the calendar and overview views.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const apartmentId = params.get('apartmentId')
    const from = params.get('from')
    const to = params.get('to')

    const supabase = getServiceClient()

    let query = supabase
      .from('bookings')
      .select(
        `id, apartment_id, guest_name, arrival_date, departure_date, budget, notes, status, created_at, updated_at,
         apartment:apartments(id, unit_number, apartment_type, building_number),
         events:booking_events(id, booking_id, event_type, event_date, event_time, title, notes, outlook_event_id, outlook_synced_at)`
      )
      .order('arrival_date', { ascending: true })

    if (apartmentId) query = query.eq('apartment_id', apartmentId)
    // Overlap filter: booking overlaps [from, to] when arrival <= to AND departure >= from.
    if (to) query = query.lte('arrival_date', to)
    if (from) query = query.gte('departure_date', from)

    const { data, error } = await query
    if (error) {
      console.error('Error listing bookings:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ bookings: data ?? [] }, { status: 200 })
  } catch (err: any) {
    console.error('Unexpected error listing bookings:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
