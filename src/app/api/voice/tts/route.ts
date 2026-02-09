import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getOpenAIConfig } from "@/lib/env";
import { requireApiAuth } from "@/lib/server/apiAuth";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/server/rateLimit";

type OpenAIConfig = {
  apiKey: string;
  baseUrl: string;
};

function getTtsConfig(): OpenAIConfig {
  const { apiKey, baseUrl } = getOpenAIConfig();
  const trimmed = baseUrl.replace(/\/+$/, "");
  const normalized = trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
  return { apiKey, baseUrl: normalized };
}

export async function POST(req: NextRequest) {
  let config: OpenAIConfig;
  let userId: string | undefined;
  try {
    // Require authenticated user to prevent public cost abuse.
    const { user } = await requireApiAuth(req);
    userId = user.id;
    const rateLimitResponse = await enforceRateLimit(
      req,
      {
        keyPrefix: "voice-tts",
        windowMs: 60_000,
        max: 120,
      },
      { identifier: user.id }
    );
    if (rateLimitResponse) return rateLimitResponse;

    config = getTtsConfig();
  } catch (configError: any) {
    if (configError instanceof NextResponse) {
      return configError;
    }
    logger.error("TTS configuration error", { userId, error: configError?.message });
    const message =
      configError?.message ||
      "Text-to-speech service is not configured. Please set OPENAI_API_KEY.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const { text, voice = "alloy" } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "Missing text input" }, { status: 400 });
    }
    if (typeof text !== "string" || text.length > 4000) {
      return NextResponse.json({ error: "Text input is invalid or too long" }, { status: 400 });
    }

    const resp = await fetch(`${config.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
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
      logger.error("TTS API error", { userId, error: err });
      return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
    }

    const arrayBuffer = await resp.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error: any) {
    logger.error("TTS error", { userId, error: error?.message });
    const message = error?.message || "Failed to generate speech";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
