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
    const { input, sessionId } = await req.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    // Call OpenAI chat completion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are the NHome voice assistant. Respond conversationally and professionally to the inspector's input. Keep responses concise and relevant.",
        },
        {
          role: "user",
          content: input,
        },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm not sure how to respond.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
