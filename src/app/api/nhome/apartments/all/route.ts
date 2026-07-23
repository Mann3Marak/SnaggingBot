import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

// GET /api/nhome/apartments/all — every apartment with its project name, for the
// booking apartment picker and the all-apartments calendar overview.
export async function GET() {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('apartments')
      .select(
        'id, unit_number, apartment_type, building_number, client_name, client_surname, project_id, projects(id, name)'
      )
      .order('building_number', { ascending: true })
      .order('unit_number', { ascending: true })

    if (error) {
      console.error('Error fetching all apartments:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ apartments: data ?? [] }, { status: 200 })
  } catch (err: any) {
    console.error('Unexpected error fetching all apartments:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
