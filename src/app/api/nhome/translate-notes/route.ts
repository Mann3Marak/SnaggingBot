import { NextResponse } from "next/server"

// Force Node.js runtime so console logs appear in terminal
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { note, resultId } = await req.json()

    if (!note || !resultId) {
      return NextResponse.json({ error: "Missing note or resultId" }, { status: 400 })
    }

    // Translate note using OpenAI API
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator that translates English inspection notes into natural, fluent Portuguese used in property inspection reports. Only return the translated text.",
          },
          {
            role: "user",
            content: note,
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("OpenAI translation failed:", errText)
      return NextResponse.json({ error: "Translation failed", details: errText }, { status: 500 })
    }

    const data = await res.json()
    const translated = data.choices?.[0]?.message?.content?.trim() || note

    // Update Supabase record with translated note
    console.log("🟢 Translation API called with:", { resultId, note });

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Debug: list all IDs in inspection_results
    const { data: allResults, error: listError } = await supabase
      .from("inspection_results")
      .select("id, notes, pt_notes")
      .limit(10);

    if (listError) {
      console.error("❌ Failed to list inspection_results:", listError);
    } else {
      console.log("📋 Sample inspection_results IDs:", allResults);
    }

    // Try updating by id
    const { data: updated, error } = await supabase
      .from("inspection_results")
      .update({ pt_notes: translated })
      .eq("id", resultId)
      .select("id, pt_notes");

    if (error) {
      console.error("❌ Supabase update error:", error);
      return NextResponse.json(
        { error: "Failed to update pt_notes", details: error.message },
        { status: 500 }
      );
    }

    if (!updated || updated.length === 0) {
      console.warn("⚠️ No rows updated — check if resultId matches inspection_results.id");
      return NextResponse.json(
        {
          success: false,
          translated,
          message: "No matching record found in inspection_results. Check if resultId is correct.",
        },
        { status: 404 }
      );
    }

    console.log("✅ Translation stored in Supabase:", updated);

    return NextResponse.json({ success: true, translated, updated });
  } catch (err: any) {
    console.error("Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 })
  }
}
