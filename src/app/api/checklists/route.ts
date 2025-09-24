import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  const supabase = createClient(url, anon)
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'T2'

    const { data, error } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('apartment_type', type)
      .order('order_sequence')

    if (error) throw error

    const nhomeContext = {
      company: 'NHome Property Setup & Management',
      standards: 'Professional Algarve Property Inspection Standards',
      founder: "Natalie O'Kelly",
      location: 'Algarve, Portugal',
    }

    return NextResponse.json({
      checklist: data ?? [],
      nhome_context: nhomeContext,
      total_items: data?.length ?? 0,
      apartment_type: type,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
