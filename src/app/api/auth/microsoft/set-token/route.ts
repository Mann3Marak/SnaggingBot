import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { access_token, expires_in } = await req.json()
    if (!access_token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    const res = NextResponse.json({ ok: true })
    const maxAge = typeof expires_in === 'number' ? Math.max(60, Math.min(60 * 60 * 24, expires_in)) : 3600
    res.cookies.set('nhome_ms_token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

