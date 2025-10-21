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
    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await req.json() : {};
    const { text, sessionId, instructions, messages } = body;

    // If text is provided, handle structured voice agent logic
    if (text && sessionId) {
      const lower = text.toLowerCase();
      let action = "none";
      let comment = "";
      if (lower.includes("good")) action = "markItemAsGood";
      else if (lower.includes("issue") || lower.includes("problem")) action = "markItemAsIssue";
      else if (lower.includes("skip") || lower.includes("next")) action = "moveToNextItem";

      const match = lower.match(/(?:because|is|looks like|seems)\s+(.*)/);
      if (match) comment = match[1].trim();

      const { moveToNextItem, markItemAsGood, markItemAsIssue, getCurrentItem } = await import("@/lib/server/nhome-inspection-state");

      let reply = "";
      let currentItemId: string | null = null;

      // Fetch current item to get its ID
      const currentItem = await getCurrentItem(sessionId);
      if (currentItem) currentItemId = currentItem.id;

      if (action === "markItemAsGood" && currentItemId) {
        await markItemAsGood(sessionId, currentItemId);
        reply = "Noted - item marked as good.";
      } else if (action === "markItemAsGood" && !currentItemId) {
        reply = "Unable to identify the current item to mark as good.";
      } else if (action === "markItemAsIssue") {
        await markItemAsIssue(sessionId, comment);
        reply = `Got it. ${comment ? "Noted: " + comment + "." : ""}`;
      } else if (action === "moveToNextItem") {
        // Prevent automatic navigation
        reply = "Okay, noted your request to move to the next item. Please confirm manually when ready.";
      } else {
        reply = "I didn’t quite catch that. Could you repeat?";
      }

      return NextResponse.json({ action, comment, reply });
    }

    // Otherwise, fallback to OpenAI conversation logic
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }
    // Sanitize and process conversation messages for OpenAI

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

    // Log only user input and agent response for debugging
    const lastUserMessage = sanitizedMessages[sanitizedMessages.length - 1]?.content || "N/A";
    console.log("🎤 User Input:", lastUserMessage);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 1,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...sanitizedMessages,
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm not sure how to respond.";

    // Log agent reply for debugging
    console.log("🤖 Agent Reply:", reply);

    // Attempt to extract structured action object from model output
    let actionData: any = null;
    const actionMatch = reply.match(/ACTION:\s*({[\s\S]*})/i);
    if (actionMatch) {
      try {
        actionData = JSON.parse(actionMatch[1]);
        console.log("🧩 Parsed Action Object:", actionData);
      } catch (err) {
        console.warn("⚠️ Failed to parse action object:", err);
      }
    }

    // Clean reply by removing ACTION block for display/TTS
    const cleanedReply = reply.replace(/ACTION:\s*{[\s\S]*}$/i, "").trim();

    // Return both human-readable reply and structured action (if any)
    return NextResponse.json({
      reply: cleanedReply,
      ...(actionData ? actionData : {}),
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
