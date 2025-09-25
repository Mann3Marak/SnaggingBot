import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.NHOME_PHOTO_BUCKET ?? 'nhome-inspection-photos'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const sessionId = formData.get('sessionId') as string | null
    const itemId = formData.get('itemId') as string | null
    const fileNameOverride = formData.get('fileName') as string | null
    const metadataRaw = formData.get('metadata') as string | null

    if (!file || !sessionId || !itemId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const safeName = fileNameOverride || file.name || `photo-${Date.now()}.jpg`
    const storagePath = `${sessionId}/${itemId}/${safeName}`
    const contentType = file.type || 'image/jpeg'

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true })

    if (uploadError) {
      console.error('NHome photo upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to store inspection photo' }, { status: 500 })
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const publicUrl = publicData?.publicUrl

    const metadata = metadataRaw ? JSON.parse(metadataRaw) : null

    const { error: dbError, data } = await supabase
      .from('nhome_inspection_photos')
      .insert({
        session_id: sessionId,
        item_id: itemId,
        file_name: safeName,
        onedrive_url: publicUrl,
        folder_path: storagePath,
        metadata,
        file_size: buffer.byteLength,
        company: metadata?.company ?? 'NHome Property Setup & Management',
        location: metadata?.location ?? 'Algarve, Portugal',
      })
      .select('*')
      .single()

    if (dbError) {
      console.error('Failed to persist inspection photo metadata:', dbError)
      return NextResponse.json({ error: 'Failed to persist inspection photo metadata' }, { status: 500 })
    }

    return NextResponse.json({ success: true, onedrive_url: publicUrl, record: data })
  } catch (error: any) {
    console.error('Unexpected photo upload error:', error)
    return NextResponse.json({ error: error?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
