import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  const model = 'gpt-4o-realtime-preview-2024-10-01'
  const voice = process.env.OPENAI_VOICE || 'alloy'
  const sessionConfig = {
    session: {
      type: 'realtime',
      model,
      instructions:
        "You are the NHome Inspection Assistant for property inspections in the Algarve. Use professional, concise language and reflect NHome quality standards.",
      // Ensure the model produces an audio media track via WebRTC
      output_modalities: ['audio'],
      audio: {
        // Request TTS output; omit input format to use WebRTC RTP input
        output: { voice, format: { type: 'audio/pcm', rate: 24000 } },
      },
    },
  }

  const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sessionConfig),
  })

  if (!resp.ok) {
    const text = await resp.text()
    return NextResponse.json({ error: 'Failed to create client secret', detail: text }, { status: 500 })
  }
  const data = await resp.json()
  return NextResponse.json({ ...data, model })
}
