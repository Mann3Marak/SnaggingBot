import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server/supabase-admin'

// POST /api/nhome/owners/delete { id } — deletes an owner. Linked apartments keep
// existing (owner_id is set to null by the FK on delete).
export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) ?? {}
    if (!id) return NextResponse.json({ error: 'Missing owner id' }, { status: 400 })

    const supabase = getServiceClient()
    const { error } = await supabase.from('owners').delete().eq('id', id)
    if (error) {
      console.error('Error deleting owner:', error)
      return NextResponse.json({ error: 'Failed to delete owner', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Owner deleted' })
  } catch (err: any) {
    console.error('Unexpected error deleting owner:', err)
    return NextResponse.json({ error: 'Unexpected server error', detail: err?.message }, { status: 500 })
  }
}
