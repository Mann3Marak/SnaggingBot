import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

// GET /api/nhome/owners/list — all owners with a count of their apartments.
export async function GET() {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('owners')
      .select(
        `id, first_name, surname, tax_number, email, phone, address, nationality,
         preferred_language, secondary_contact_name, secondary_contact_phone, notes, created_at,
         apartments:apartments(id, unit_number, apartment_type, building_number, project_id, projects(id, name))`
      )
      .order('surname', { ascending: true })

    if (error) {
      console.error('Error listing owners:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ owners: data ?? [] }, { status: 200 })
  } catch (err: any) {
    console.error('Unexpected error listing owners:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
