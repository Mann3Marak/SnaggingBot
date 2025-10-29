import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_ID = "nhome_photos";

function resolveStoragePath(
  sessionId: string,
  fileName: string,
  storedPath?: string | null
) {
  const stripQuery = (value: string) => value.split("?")[0];

  if (!storedPath) {
    return `sessions/${sessionId}/${fileName}`;
  }

  if (storedPath.startsWith("sessions/")) {
    return stripQuery(storedPath);
  }

  const marker = "/nhome_photos/";
  const markerIndex = storedPath.indexOf(marker);
  if (markerIndex >= 0) {
    return stripQuery(storedPath.slice(markerIndex + marker.length));
  }

  return stripQuery(storedPath);
}

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId") ?? searchParams.get("item_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const query = supabase
      .from("nhome_photos")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (itemId) {
      query.eq("item_id", itemId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "[NHomePhotos] Failed to load photos",
        { sessionId, itemId, error }
      );
      return NextResponse.json(
        { error: "Failed to load photos" },
        { status: 500 }
      );
    }

    const photosWithUrls = await Promise.all(
      (data ?? []).map(async (photo) => {
        const path = resolveStoragePath(
          sessionId,
          photo.file_name,
          photo.supabase_url
        );

        const { data: signed, error: signedError } = await supabase.storage
          .from(BUCKET_ID)
          .createSignedUrl(path, 60 * 60 * 24); // 24 hours

        if (signedError) {
          console.warn(
            "[NHomePhotos] Unable to create signed URL",
            { sessionId, path, error: signedError }
          );
        }

        return {
          ...photo,
          storage_path: path,
          signed_url: signed?.signedUrl ?? null,
        };
      })
    );

    return NextResponse.json({ photos: photosWithUrls });
  } catch (err: any) {
    console.error("[NHomePhotos] Unexpected GET error", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const body = await req.json();
    const {
      item_id,
      file_name,
      storage_url,
      supabase_url,
      metadata,
    } = body;

    if (!item_id || !file_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const storagePath = resolveStoragePath(
      sessionId,
      file_name,
      supabase_url ?? storage_url
    );

    const { data, error } = await supabase
      .from("nhome_photos")
      .insert([
        {
          session_id: sessionId,
          item_id,
          file_name,
          supabase_url: storagePath,
          inspector_name: metadata?.inspector ?? "NHome Inspector",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(
        "[NHomePhotos] Failed to persist metadata",
        { sessionId, item_id, file_name, error }
      );
      return NextResponse.json(
        { error: "Failed to save photo" },
        { status: 500 }
      );
    }

    console.log(
      `[NHomePhotos] Stored photo metadata`,
      { sessionId, item_id, file_name }
    );

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET_ID)
      .createSignedUrl(storagePath, 60 * 60 * 24);

    if (signedError) {
      console.warn(
        "[NHomePhotos] Metadata stored but unable to create signed URL",
        { sessionId, storagePath, error: signedError }
      );
    }

    return NextResponse.json({
      success: true,
      photo: {
        ...data,
        storage_path: storagePath,
        signed_url: signed?.signedUrl ?? null,
      },
    });
  } catch (err: any) {
    console.error("[NHomePhotos] Unexpected POST error", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
