import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

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

// POST /api/nhome/owners/update — update an owner.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) ?? {}
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing owner id' }, { status: 400 })
    if ('tax_number' in body && !String(body.tax_number ?? '').trim()) {
      return NextResponse.json({ error: 'Tax number is required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const patch: Record<string, unknown> = {}
    for (const f of FIELDS) {
      if (f in body) {
        const v = body[f]
        patch[f] = v == null || v === '' ? (f === 'tax_number' ? undefined : null) : String(v).trim()
      }
    }

    const { data, error } = await supabase
      .from('owners')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate tax number', detail: 'An owner with this tax number already exists.' },
          { status: 409 }
        )
      }
      console.error('Error updating owner:', error)
      return NextResponse.json({ error: 'Failed to update owner', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Owner updated', owner: data })
  } catch (err: any) {
    console.error('Unexpected error updating owner:', err)
    return NextResponse.json({ error: 'Unexpected server error', detail: err?.message }, { status: 500 })
  }
}
