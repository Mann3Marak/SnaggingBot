import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function translateToPortuguese(text: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator. Translate the following text into Portuguese, preserving meaning and tone.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? text;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const { record } = await req.json();
  if (!record?.id || !record?.enhanced_notes) {
    return new Response("Invalid payload", { status: 400 });
  }

  const translated = await translateToPortuguese(record.enhanced_notes);

  const { error } = await supabase
    .from("inspection_results_pt")
    .upsert({
      inspection_result_id: record.id,
      enhanced_notes_pt: translated,
      translated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("translate-note: failed to insert translation", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  console.log("translate-note: translation stored for record", record.id);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
