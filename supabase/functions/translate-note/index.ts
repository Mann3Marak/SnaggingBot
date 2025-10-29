import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("📩 Incoming payload:", JSON.stringify(payload, null, 2));

    // Handle both direct calls and webhook payloads
    const note = payload?.note || payload?.record?.notes;
    const resultId = payload?.resultId || payload?.record?.id;

    console.log("🧠 Extracted values:", { note, resultId });

    if (!note || !resultId) {
      console.warn("⚠️ Missing note or resultId in payload");
      return new Response(JSON.stringify({ error: "Missing note or resultId", payload }), { status: 400 });
    }

    // Translate using OpenAI with stronger enforcement
    async function translateText(text: string): Promise<string> {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are a professional translator. Translate the following English text into Portuguese. Respond ONLY with the translated Portuguese text, no explanations, no repetition of the original.",
            },
            { role: "user", content: text },
          ],
        }),
      });

      const data = await res.json();
      console.log("🧾 Raw OpenAI response:", JSON.stringify(data, null, 2));
      return data.choices?.[0]?.message?.content?.trim() || text;
    }

    let translated = await translateText(note);

    // Retry once if translation equals input
    if (translated.toLowerCase() === note.toLowerCase()) {
      console.warn("⚠️ Translation identical to input, retrying with stricter prompt...");
      translated = await translateText(`Translate this to Portuguese: ${note}`);
    }

    // Update Supabase record
    // Load environment variables securely (using non-reserved names)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      console.error("❌ Missing required environment variables.");
      console.log("🔍 Current environment state:", {
        SB_URL: supabaseUrl,
        SB_SERVICE_ROLE_KEY: !!supabaseKey,
        OPENAI_API_KEY: !!openaiKey,
      });
      return new Response(
        JSON.stringify({
          error: "Missing environment variables",
          details: {
            SB_URL: !!supabaseUrl,
            SB_SERVICE_ROLE_KEY: !!supabaseKey,
            OPENAI_API_KEY: !!openaiKey,
          },
        }),
        { status: 500 },
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: updateData, error } = await supabase
      .from("inspection_results")
      .update({ pt_notes: translated })
      .eq("id", resultId)
      .select();

    if (error) {
      console.error("❌ Supabase update error:", error);
      return new Response(JSON.stringify({ error: error.message, resultId, translated }), { status: 500 });
    }

    console.log("✅ Translation stored successfully for:", resultId, "Updated row:", updateData);
    return new Response(JSON.stringify({ success: true, resultId, translated, updateData }), { status: 200 });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
