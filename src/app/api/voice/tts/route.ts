import { NextResponse } from "next/server";
import { getOpenAIConfig } from "@/lib/env";

const { apiKey, baseUrl } = getOpenAIConfig();

export async function POST(req: Request) {
  try {
    const { text, voice = "alloy" } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text input" }, { status: 400 });
    }

    const resp = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: text,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("TTS API error:", err);
      return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
    }

    const arrayBuffer = await resp.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error: any) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
  }
}
