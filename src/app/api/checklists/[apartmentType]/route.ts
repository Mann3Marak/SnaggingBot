import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: { apartmentType: string } }
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
      console.error('Supabase environment variables missing at runtime')
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }
    const supabase = createClient(url, anon)

    const type = decodeURIComponent(params.apartmentType)
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

