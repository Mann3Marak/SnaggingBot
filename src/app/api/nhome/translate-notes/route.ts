import { NextRequest, NextResponse } from "next/server"
import { requireOwnership, createServiceClient } from "@/lib/server/apiAuth"

// Force Node.js runtime so console logs appear in terminal
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { note, resultId } = await req.json()

    if (!note || !resultId) {
      return NextResponse.json({ error: "Missing note or resultId" }, { status: 400 })
    }

    // Verify user owns the result's session or is admin
    const { user } = await requireOwnership(req, {
      type: "result",
      resourceId: resultId,
    })

    console.info("[Translate Notes] Translating note", {
      resultId,
      userId: user.id,
    })

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

    console.info("[Translate Notes] Translation completed", {
      resultId,
      userId: user.id,
    })

    // Use service role to update record (RLS might block updates)
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    })

    // Update inspection_result with translated note
    const { data: updated, error } = await supabase
      .from("inspection_results")
      .update({ pt_notes: translated })
      .eq("id", resultId)
      .select("id, pt_notes");

    if (error) {
      console.error("[Translate Notes] Supabase update error", {
        error: error.message,
        resultId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Failed to update pt_notes", details: error.message },
        { status: 500 }
      );
    }

    if (!updated || updated.length === 0) {
      console.warn("[Translate Notes] No rows updated", {
        resultId,
        userId: user.id,
      });
      return NextResponse.json(
        {
          success: false,
          translated,
          message: "No matching record found in inspection_results. Check if resultId is correct.",
        },
        { status: 404 }
      );
    }

    console.info("[Translate Notes] Translation stored successfully", {
      resultId,
      userId: user.id,
    });

    return NextResponse.json({ success: true, translated, updated });
  } catch (err: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (err instanceof NextResponse) {
      return err;
    }

    console.error("[Translate Notes] Unexpected error", {
      error: err.message,
    });
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 })
  }
}
