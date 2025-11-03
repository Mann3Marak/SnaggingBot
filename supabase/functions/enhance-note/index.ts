import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type DatabaseEvent = {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: InspectionResult | null;
  old_record?: InspectionResult | null;
};

type InspectionResult = {
  id: string;
  notes?: string | null;
  enhanced_notes?: string | null;
};

const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");

const supabaseUrl =
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("SUPABASE_PROJECT_URL") ??
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ??
  "";

const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: { "X-Client-Info": "enhance-note-edge-function/1.0.0" },
      },
    })
  : null;

const OPENAI_MODEL = Deno.env.get("ENHANCE_NOTE_MODEL") ?? "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(
  Deno.env.get("ENHANCE_NOTE_TIMEOUT_MS") ?? "15000",
);
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function enhanceNote(original: string): Promise<string> {
  if (!openAiKey) {
    console.error("enhance-note: OPENAI_API_KEY is not configured");
    return original;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are a construction snagging assistant. Rewrite the inspection note so it is clear, specific, and actionable for contractors. Do not add new findings. Use professional, concise language.",
          },
          {
            role: "user",
            content: `Original inspection note: "${original}"\n\nProvide an improved version.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        "enhance-note: OpenAI request failed:",
        await response.text(),
      );
      return original;
    }

    const data = await response.json();
    const enhanced =
      data?.choices?.[0]?.message?.content?.trim() ?? original.trim();
    return enhanced.length > 0 ? enhanced : original;
  } catch (error) {
    console.error("enhance-note: OpenAI request error", error);
    return original;
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let payload: DatabaseEvent;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("enhance-note: failed to parse request body", error);
    return jsonResponse({ error: "invalid_payload" }, 400);
  }

  const eventType = payload.type ?? "UNKNOWN";
  const record = payload.record;
  const oldRecord = payload.old_record;

  if (!record || !record.id) {
    console.warn("enhance-note: missing record or record id", payload);
    return jsonResponse({ skipped: true, reason: "missing_record" });
  }

  const note = (record.notes ?? "").trim();
  if (!note) {
    console.log(
      "enhance-note: skipping because note is empty",
      record.id,
    );
    return jsonResponse({ skipped: true, reason: "empty_note" });
  }

  if (eventType === "UPDATE" && oldRecord) {
    const oldNote = (oldRecord.notes ?? "").trim();
    if (oldNote === note) {
      console.log(
        "enhance-note: skipping because note did not change",
        record.id,
      );
      return jsonResponse({ skipped: true, reason: "notes_unchanged" });
    }
  }

  const enhanced = await enhanceNote(note);
  const enhancedTrimmed = enhanced.trim();
  const alreadyStored = (record.enhanced_notes ?? "").trim();

  if (!enhancedTrimmed || enhancedTrimmed === alreadyStored) {
    console.log(
      "enhance-note: generated text matches existing enhanced note, skipping update",
      record.id,
    );
    return jsonResponse({ skipped: true, reason: "no_change" });
  }

  if (!supabase) {
    console.error("enhance-note: Supabase client is not configured");
    return jsonResponse({ error: "missing_supabase_credentials" }, 500);
  }

  const { data, error } = await supabase
    .from("inspection_results")
    .update({ enhanced_notes: enhancedTrimmed })
    .eq("id", record.id)
    .select("id");

  if (error) {
    console.error("enhance-note: failed to update inspection_results", error);
    return jsonResponse(
      { error: "supabase_update_failed", details: error.message },
      500,
    );
  }

  console.log("enhance-note: updated record", { recordId: record.id, data });

  // Trigger translation webhook after enhancement completes
  try {
    await fetch("https://aojewecjssqwkhtrcjim.functions.supabase.co/translate-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "TRANSLATE",
        record: { id: record.id, enhanced_notes: enhancedTrimmed },
      }),
    });
    console.log("enhance-note: triggered translation webhook for record", record.id);
  } catch (err) {
    console.error("enhance-note: failed to trigger translation webhook", err);
  }

  return jsonResponse({
    success: true,
    recordId: record.id,
    enhanced_notes: enhancedTrimmed,
  });
});
