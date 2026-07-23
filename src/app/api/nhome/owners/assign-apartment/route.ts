import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

// POST /api/nhome/owners/assign-apartment { apartment_id, owner_id | null }
// Attaches an apartment to an owner (or detaches when owner_id is null).
export async function POST(req: NextRequest) {
  try {
    const { apartment_id, owner_id } = (await req.json()) ?? {}
    if (!apartment_id) {
      return NextResponse.json({ error: 'Missing apartment_id' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('apartments')
      .update({ owner_id: owner_id || null })
      .eq('id', apartment_id)
      .select('id, owner_id')
      .single()

    if (error) {
      console.error('Error assigning apartment:', error)
      return NextResponse.json({ error: 'Failed to assign apartment', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Apartment assignment updated', apartment: data })
  } catch (err: any) {
    console.error('Unexpected error assigning apartment:', err)
    return NextResponse.json({ error: 'Unexpected server error', detail: err?.message }, { status: 500 })
  }
}
