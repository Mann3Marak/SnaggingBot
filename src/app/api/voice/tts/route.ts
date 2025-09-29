import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIConfig } from "@/lib/env";

const { apiKey, baseUrl } = getOpenAIConfig();
const openai = new OpenAI({ apiKey, baseURL: baseUrl });

export async function POST(req: Request) {
  try {
    const { text, voice = "alloy" } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text input" }, { status: 400 });
    }

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
    });

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error: any) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
  }
}
