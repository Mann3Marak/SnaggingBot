import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIConfig } from "@/lib/env";
import { requireApiAuth, requireOwnership } from "@/lib/server/apiAuth";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/server/rateLimit";

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

export async function POST(req: NextRequest) {
  try {
    // Enforce authentication for all agent paths to prevent anonymous model usage.
    const { user } = await requireApiAuth(req);
    const rateLimitResponse = await enforceRateLimit(
      req,
      {
        keyPrefix: "nhome-agent",
        windowMs: 60_000,
        max: 90,
      },
      { identifier: user.id }
    );
    if (rateLimitResponse) return rateLimitResponse;

    const contentType = req.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await req.json() : {};
    const { text, sessionId, instructions, messages } = body;

    // If text is provided, handle structured voice agent logic
    if (text && sessionId) {
      // Verify user owns the session or is admin
      const { user } = await requireOwnership(req, {
        type: "session",
        resourceId: sessionId,
      });

      logger.info('[Agent] Voice command processing', {
        sessionId,
        userId: user.id,
        textLength: text.length,
      });
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
      } else if (action === "markItemAsIssue" && currentItemId) {
        await markItemAsIssue(sessionId, currentItemId, comment);
        reply = `Got it. ${comment ? "Noted: " + comment + "." : ""}`;
      } else if (action === "markItemAsIssue" && !currentItemId) {
        reply = "Unable to identify the current item to mark as issue.";
      } else if (action === "moveToNextItem") {
        // Prevent automatic navigation
        reply = "Okay, noted your request to move to the next item. Please confirm manually when ready.";
      } else {
        reply = "I didn’t quite catch that. Could you repeat?";
      }

      logger.info('[Agent] Voice command processed', {
        sessionId,
        userId: user.id,
        action,
      });

      return NextResponse.json({ action, comment, reply });
    }

    // Otherwise, fallback to OpenAI conversation logic
    // Note: Conversation mode doesn't modify sessions, so it's less critical but still authenticated
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

    logger.debug("[Agent] Conversation request", {
      userId: user.id,
      messageCount: sanitizedMessages.length,
      lastMessageLength: sanitizedMessages[sanitizedMessages.length - 1]?.content?.length || 0,
    });

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

    logger.debug("[Agent] Conversation response generated", {
      userId: user.id,
      replyLength: reply.length,
    });

    // Attempt to extract structured action object from model output
    let actionData: any = null;
    const actionMatch = reply.match(/ACTION:\s*({[\s\S]*})/i);
    if (actionMatch) {
      try {
        actionData = JSON.parse(actionMatch[1]);
        logger.debug("[Agent] Parsed action object", {
          userId: user.id,
          keys: Object.keys(actionData || {}),
        });
      } catch (err) {
        logger.warn("[Agent] Failed to parse action object");
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
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    logger.error("[Agent] Error processing request", {
      error: error.message,
    });
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
