import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAppGraphToken } from '@/lib/server/nhome-graph-auth'

export async function GET() {
  const c = cookies()
  const cookieToken = c.get('nhome_ms_token')?.value
  if (cookieToken) {
    return NextResponse.json({ access_token: cookieToken })
  }

  try {
    const accessToken = await getAppGraphToken()
    return NextResponse.json({ access_token: accessToken, token_type: 'app' })
  } catch (e: any) {
    const fallbackToken = process.env.NHOME_MS_ACCESS_TOKEN
    if (fallbackToken) {
      return NextResponse.json({ access_token: fallbackToken })
    }
    return NextResponse.json({ error: 'App-only token error', detail: e?.message }, { status: 500 })
  }
}
