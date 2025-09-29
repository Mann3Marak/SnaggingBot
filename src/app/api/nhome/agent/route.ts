import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIConfig } from "@/lib/env";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentRequestBody = {
  instructions?: string;
  messages?: ConversationMessage[];
  sessionId?: string;
};

const { apiKey, baseUrl } = getOpenAIConfig();

const normalizedBaseUrl = baseUrl
  ? (() => {
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      return trimmedBaseUrl.endsWith("/v1") ? trimmedBaseUrl : `${trimmedBaseUrl}/v1`;
    })()
  : undefined;

const openai = new OpenAI({ apiKey, baseURL: normalizedBaseUrl });

import { NHOME_WORKFLOW_PROMPT } from "@/lib/nhome-workflow-prompt";

const BASE_SYSTEM_PROMPT = NHOME_WORKFLOW_PROMPT;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgentRequestBody;
    const { instructions, messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const sanitizedMessages = messages
      .filter((m): m is ConversationMessage => Boolean(m?.role && m?.content))
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0);

    if (sanitizedMessages.length === 0) {
      return NextResponse.json({ error: "No valid messages provided" }, { status: 400 });
    }

    const systemPrompt = instructions?.trim()
      ? `${BASE_SYSTEM_PROMPT}\n\n${instructions.trim()}`
      : BASE_SYSTEM_PROMPT;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...sanitizedMessages,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm not sure how to respond.";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
