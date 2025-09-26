import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01'
  const voice = process.env.OPENAI_VOICE || 'alloy'

  const sessionConfig = {
    session: {
      type: 'realtime',
      model,
      instructions:
        "You are the NHome Inspection Assistant for property inspections in the Algarve. Use professional, concise language and reflect NHome quality standards.",
      output_modalities: ['audio'],
      audio: {
        output: { voice, format: { type: 'audio/pcm', rate: 24000 } },
        input: { format: { type: 'audio/pcm', rate: 24000 } },
      },
    },
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    })

    const text = await resp.text()
    if (!resp.ok) {
      try {
        const json = JSON.parse(text)
        return NextResponse.json({ error: 'Failed to create client secret', detail: json, status: resp.status }, { status: 500 })
      } catch {
        return NextResponse.json({ error: 'Failed to create client secret', detail: text || null, status: resp.status }, { status: 500 })
      }
    }
    const data = text ? JSON.parse(text) : {}
    return NextResponse.json({ ...data, model })
  } catch (e: any) {
    return NextResponse.json({ error: 'Client secret request failed', detail: e?.message || String(e) }, { status: 500 })
  }
}
