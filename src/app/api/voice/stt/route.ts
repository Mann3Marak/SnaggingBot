import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIConfig } from "@/lib/env";

const { apiKey, baseUrl } = getOpenAIConfig();

const normalizedBaseUrl = baseUrl
  ? (() => {
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      return trimmedBaseUrl.endsWith("/v1") ? trimmedBaseUrl : `${trimmedBaseUrl}/v1`;
    })()
  : undefined;

const openai = new OpenAI({ apiKey, baseURL: normalizedBaseUrl });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    let uploadable: File;

    if (typeof file.size === "number" && !Number.isNaN(file.size)) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "Audio file too large (max 25MB)" },
          { status: 413 }
        );
      }
      uploadable = file;
    } else {
      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "Audio file too large (max 25MB)" },
          { status: 413 }
        );
      }
      uploadable = new File([arrayBuffer], file.name || "audio.webm", {
        type: file.type || "audio/webm"
      });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: uploadable,
      model: "gpt-4o-transcribe",
      response_format: "json"
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error("STT error:", error);
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 });
  }
}
