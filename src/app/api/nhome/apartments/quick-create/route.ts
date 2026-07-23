import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

const APARTMENT_TYPES = ['T2', 'T2+1', 'T3', 'T3+1']

// POST /api/nhome/apartments/quick-create
// Owner-driven apartment creation for units that never went through snagging.
// Project is optional (unlike the inspection-focused /api/nhome/apartments route).
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) ?? {}
    const {
      owner_id,
      unit_number,
      apartment_type,
      building_number,
      project_id,
    } = body

    if (!unit_number || !String(unit_number).trim()) {
      return NextResponse.json({ error: 'Apartment / unit number is required' }, { status: 400 })
    }
    const type = apartment_type || 'T2'
    if (!APARTMENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Apartment type must be one of ${APARTMENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()
    const normalizedUnit = String(unit_number).replace(/\s+/g, '').trim()

    const { data, error } = await supabase
      .from('apartments')
      .insert([
        {
          owner_id: owner_id || null,
          unit_number: normalizedUnit,
          apartment_type: type,
          building_number: building_number || null,
          project_id: project_id || null,
        },
      ])
      .select('id, unit_number, apartment_type, building_number, project_id, owner_id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          {
            error: 'Duplicate apartment',
            detail: 'An apartment with this unit number already exists in this project.',
          },
          { status: 409 }
        )
      }
      console.error('Error quick-creating apartment:', error)
      return NextResponse.json(
        { error: 'Failed to create apartment', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Apartment created', apartment: data })
  } catch (err: any) {
    console.error('Unexpected error quick-creating apartment:', err)
    return NextResponse.json({ error: 'Unexpected server error', detail: err?.message }, { status: 500 })
  }
}
