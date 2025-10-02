import { NextResponse } from 'next/server'
import { getAppGraphToken } from '@/lib/server/nhome-graph-auth'

export async function GET() {
  try {
    const access_token = await getAppGraphToken()
    return NextResponse.json({ access_token })
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: e?.message }, { status: 500 })
  }
}
