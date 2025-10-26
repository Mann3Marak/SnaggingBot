import { NextResponse } from "next/server"

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
    const { createClient } = await import("@supabase/supabase-js")
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from("nhome_inspection_results")
      .update({ pt_notes: translated })
      .eq("id", resultId)

    if (error) {
      console.error("Supabase update error:", error)
      return NextResponse.json({ error: "Failed to update pt_notes", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, translated })
  } catch (err: any) {
    console.error("Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 })
  }
}
