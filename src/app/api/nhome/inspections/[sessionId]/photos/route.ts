import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_ID = "nhome_photos";

const tryDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

function resolveStoragePath(
  sessionId: string,
  fileName: string | null | undefined,
  storedPath?: string | null
) {
  const safeName = fileName && fileName.trim().length > 0 ? fileName : `photo-${Date.now()}.jpg`;
  const stripQuery = (value: string) => value.split("?")[0];

  if (!storedPath) {
    return `sessions/${sessionId}/${safeName}`;
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

function buildStorageCandidates(options: {
  sessionId: string;
  fileName?: string | null;
  storedPath?: string | null;
  itemId?: string | null;
}) {
  const { sessionId, fileName, storedPath, itemId } = options;
  const safeName = fileName && fileName.trim().length > 0 ? fileName : `photo-${Date.now()}.jpg`;
  const candidates = new Set<string>();

  if (storedPath) {
    candidates.add(tryDecode(resolveStoragePath(sessionId, safeName, storedPath)));
  }

  candidates.add(`sessions/${sessionId}/${safeName}`);

  if (itemId) {
    candidates.add(`sessions/${sessionId}/${itemId}/${safeName}`);
    candidates.add(`${sessionId}/${itemId}/${safeName}`);
  }

  return Array.from(candidates);
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
        const candidates = buildStorageCandidates({
          sessionId,
          fileName: photo.file_name,
          storedPath: photo.storage_path ?? photo.supabase_url,
          itemId: photo.item_id,
        });
        let signedUrl: string | null = null;
        let finalPath = candidates[0] ?? `sessions/${sessionId}/photo-${Date.now()}.jpg`;
        let lastError: string | null = null;

        for (const candidate of candidates) {
          const { data: signed, error: signedError } = await supabase.storage
            .from(BUCKET_ID)
            .createSignedUrl(candidate, 60 * 60 * 24); // 24 hours

          if (signedError) {
            lastError = signedError.message;
            continue;
          }

          if (signed?.signedUrl) {
            signedUrl = signed.signedUrl;
            finalPath = candidate;
            break;
          }
        }

        if (!signedUrl) {
          console.warn(
            "[NHomePhotos] Unable to create signed URL",
            { sessionId, path: finalPath, candidates, error: lastError ?? "Unknown storage error" }
          );
        }

        return {
          ...photo,
          storage_path: finalPath,
          signed_url: signedUrl,
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
      file_size,
      image_dimensions,
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
          metadata: metadata ?? null,
          file_size: file_size ?? null,
          image_dimensions: image_dimensions ?? null,
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
