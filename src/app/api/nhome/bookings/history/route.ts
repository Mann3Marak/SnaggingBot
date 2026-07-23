import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

// GET /api/nhome/bookings/history?bookingId=&limit=
// Recent audit entries across all bookings (or a single booking), for the History
// view (requirement #4). Joins the booking to surface guest/apartment context.
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const bookingId = params.get('bookingId')
    const limit = Math.min(Number(params.get('limit')) || 100, 500)

    const supabase = getServiceClient()

    let query = supabase
      .from('booking_audit')
      .select(
        `id, booking_id, action, actor_email, changes, created_at,
         booking:bookings(id, guest_name, arrival_date, departure_date,
           apartment:apartments(unit_number, building_number))`
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (bookingId) query = query.eq('booking_id', bookingId)

    const { data, error } = await query
    if (error) {
      console.error('Error fetching history:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ history: data ?? [] }, { status: 200 })
  } catch (err: any) {
    console.error('Unexpected error fetching history:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
