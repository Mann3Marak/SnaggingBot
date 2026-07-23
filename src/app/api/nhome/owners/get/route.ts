import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

// GET /api/nhome/owners/get?id= — single owner with their linked apartments.
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('owners')
      .select(
        `id, first_name, surname, tax_number, email, phone, address, nationality,
         preferred_language, secondary_contact_name, secondary_contact_phone, notes, created_at,
         apartments:apartments(id, unit_number, apartment_type, building_number, project_id, projects(id, name))`
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching owner:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Owner not found' }, { status: 404 })

    return NextResponse.json({ owner: data }, { status: 200 })
  } catch (err: any) {
    console.error('Unexpected error fetching owner:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
