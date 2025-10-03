import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { getOpenAIConfig } from "@/lib/env";

type OpenAIClient = ReturnType<typeof createClient>;

let cachedClient: OpenAIClient | null = null;

function createClient() {
  const { apiKey, baseUrl } = getOpenAIConfig();
  const trimmed = baseUrl.replace(/\/+$/, "");
  const normalized = trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
  return new OpenAI({ apiKey, baseURL: normalized });
}

function getClient(): OpenAIClient {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

async function createUploadableFile(file: File, maxBytes: number) {
  const arrayBuffer = await file.arrayBuffer();
  const size = arrayBuffer.byteLength;
  if (size === 0) {
    throw new Error("Audio file is empty");
  }
  if (size > maxBytes) {
    throw new Error(`Audio file too large (max ${(maxBytes / (1024 * 1024)).toFixed(1)}MB)`);
  }

  const filename = file.name && file.name !== "" ? file.name : "audio.webm";
  const mimeType = file.type && file.type !== "" ? file.type : "audio/webm";
  const buffer = Buffer.from(arrayBuffer);

  return toFile(buffer, filename, { type: mimeType });
}

export async function POST(req: Request) {
  let openai: OpenAIClient;

  try {
    openai = getClient();
  } catch (configError: any) {
    console.error("STT configuration error:", configError);
    const message =
      configError?.message ||
      "Speech-to-text service is not configured. Please set OPENAI_API_KEY.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    const uploadable = await createUploadableFile(file, MAX_FILE_BYTES);

    const transcription = await openai.audio.transcriptions.create({
      file: uploadable,
      model: "gpt-4o-transcribe",
      response_format: "json",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error("STT error:", error);
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Failed to transcribe audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
