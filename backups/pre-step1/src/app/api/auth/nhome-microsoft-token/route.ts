import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const c = cookies()
  const cookieToken = c.get('nhome_ms_token')?.value
  if (cookieToken) return NextResponse.json({ access_token: cookieToken })
  // App-only fallback: mint a client-credentials token using server env
  const tenant = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET
  if (tenant && clientId && clientSecret) {
    try {
      const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      })
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return NextResponse.json({ error: 'Failed to mint app-only token', detail: text }, { status: 500 })
      }
      const data = await resp.json()
      return NextResponse.json({ access_token: data.access_token, token_type: 'app' })
    } catch (e: any) {
      return NextResponse.json({ error: 'App-only token error', detail: e?.message }, { status: 500 })
    }
  }
  // Legacy test var support
  const envToken = process.env.NHOME_MS_ACCESS_TOKEN
  if (envToken) return NextResponse.json({ access_token: envToken })
  return NextResponse.json({ error: 'Not authenticated with Microsoft' }, { status: 401 })
}
