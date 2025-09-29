import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIConfig } from "@/lib/env";

const { apiKey, baseUrl } = getOpenAIConfig();
const openai = new OpenAI({ apiKey, baseURL: baseUrl });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    // Convert File to a Node.js readable stream for OpenAI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Enforce 25MB limit (OpenAI API restriction)
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file too large (max 25MB)" }, { status: 413 });
    }

    // Use a Uint8Array with filename (per OpenAI Node SDK spec for Uploadable)
    const transcription = await openai.audio.transcriptions.create({
      file: {
        name: file.name || "audio.webm",
        type: file.type || "audio/webm",
        arrayBuffer: async () => arrayBuffer
      } as any,
      model: "gpt-4o-transcribe",
      response_format: "json"
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error("STT error:", error);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
