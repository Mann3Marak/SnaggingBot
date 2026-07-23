import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getActor } from '@/lib/server/supabase-admin'

const FIELDS = [
  'first_name',
  'surname',
  'tax_number',
  'email',
  'phone',
  'address',
  'nationality',
  'preferred_language',
  'secondary_contact_name',
  'secondary_contact_phone',
  'notes',
] as const

// POST /api/nhome/owners — create an owner. Tax number is mandatory + unique/company.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) ?? {}
    const taxNumber = (body.tax_number ?? '').toString().trim()
    if (!taxNumber) {
      return NextResponse.json({ error: 'Tax number is required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const actor = await getActor()

    const record: Record<string, unknown> = { created_by: actor.id }
    for (const f of FIELDS) {
      const v = body[f]
      record[f] = v == null || v === '' ? null : String(v).trim()
    }
    record.tax_number = taxNumber

    const { data, error } = await supabase
      .from('owners')
      .insert([record])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate tax number', detail: 'An owner with this tax number already exists.' },
          { status: 409 }
        )
      }
      console.error('Error creating owner:', error)
      return NextResponse.json(
        { error: 'Failed to create owner', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Owner created', owner: data })
  } catch (err: any) {
    console.error('Unexpected error creating owner:', err)
    return NextResponse.json({ error: 'Unexpected server error', detail: err?.message }, { status: 500 })
  }
}
