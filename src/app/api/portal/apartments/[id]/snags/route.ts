import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, requireApiAuth } from '@/lib/server/apiAuth';

const BUCKET_ID = 'nhome_photos';

function resolveStoragePath(sessionId: string, fileName: string | null | undefined, storedPath?: string | null) {
  const safeName = fileName && fileName.trim().length > 0 ? fileName : `photo-${Date.now()}.jpg`;
  const stripQuery = (value: string) => value.split('?')[0];

  if (!storedPath) return `sessions/${sessionId}/${safeName}`;
  if (storedPath.startsWith('sessions/')) return stripQuery(storedPath);

  const marker = '/nhome_photos/';
  const markerIndex = storedPath.indexOf(marker);
  if (markerIndex >= 0) {
    return stripQuery(storedPath.slice(markerIndex + marker.length));
  }

  return stripQuery(storedPath);
}

/**
 * Portal endpoint: Get outstanding snags (issues) for a specific apartment
 *
 * Security - IDOR Prevention:
 * 1. RLS enforcement: Apartment query filtered by company_id
 * 2. Ownership verification: Return 404 if apartment doesn't belong to user's company
 * 3. Cascading security: Inspection sessions also filtered by RLS
 *
 * Returns:
 * - Outstanding snags (issue/critical status) from latest completed inspection
 * - Item details (room, checklist item, notes, photos)
 * - Grouped by room for easy navigation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apartmentId = params.id;

  try {
    // 1. ALWAYS authenticate first
    const { user, profile, supabase } = await requireApiAuth(req);

    console.info('[Portal /apartments/[id]/snags] Loading snags', {
      apartmentId,
      userId: user.id,
      companyId: profile.company_id,
    });

    // 2. Verify apartment belongs to user's company (IDOR protection)
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('id, unit_number')
      .eq('id', apartmentId)
      .maybeSingle();

    if (apartmentError) {
      console.error('[Portal /apartments/[id]/snags] Database error', {
        error: apartmentError.message,
        apartmentId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to load snags', detail: apartmentError.message },
        { status: 500 }
      );
    }

    // 3. IDOR Protection: Return 404 if apartment not found or unauthorized
    if (!apartment) {
      console.warn('[Portal /apartments/[id]/snags] Apartment not found or unauthorized', {
        apartmentId,
        userId: user.id,
        companyId: profile.company_id,
      });
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    // 4. Find latest completed inspection for this apartment
    const { data: latestInspection } = await supabase
      .from('inspection_sessions')
      .select('id, started_at, completed_at, inspection_type')
      .eq('apartment_id', apartmentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestInspection) {
      console.info('[Portal /apartments/[id]/snags] No completed inspections found', {
        apartmentId,
        userId: user.id,
      });
      return NextResponse.json({
        apartment: {
          id: apartment.id,
          unit_number: apartment.unit_number,
        },
        snags: [],
        totalSnags: 0,
        latestInspection: null,
        message: 'No completed inspections found for this apartment',
      });
    }

    // 5. Fetch outstanding snags (issue/critical items)
    const { data: snags, error: snagsError } = await supabase
      .from('inspection_results')
      .select(`
        id,
        status,
        notes,
        pt_notes,
        created_at,
        item_id,
        checklist_templates:item_id (
          room_type,
          item_description
        )
      `)
      .eq('session_id', latestInspection.id)
      .in('status', ['issue', 'critical'])
      .order('created_at', { ascending: true });

    if (snagsError) {
      console.error('[Portal /apartments/[id]/snags] Failed to load snags', {
        error: snagsError.message,
        apartmentId,
        sessionId: latestInspection.id,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to load snags', detail: snagsError.message },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const itemIds = Array.from(new Set((snags || []).map((s) => s.item_id).filter(Boolean)));
    let photosByItemId: Record<string, Array<{ id: string; storage_path: string; signed_url: string | null; created_at: string }>> = {};

    if (itemIds.length > 0) {
      const { data: photos, error: photosError } = await adminClient
        .from('nhome_photos')
        .select('id, item_id, file_name, storage_path, supabase_url, created_at')
        .eq('session_id', latestInspection.id)
        .in('item_id', itemIds)
        .order('created_at', { ascending: true });

      if (photosError) {
        console.error('[Portal /apartments/[id]/snags] Failed to load snag photos', {
          error: photosError.message,
          apartmentId,
          sessionId: latestInspection.id,
          userId: user.id,
        });
      } else {
        const signedRows = await Promise.all(
          (photos || []).map(async (photo) => {
            const storagePath = resolveStoragePath(
              latestInspection.id,
              photo.file_name,
              photo.storage_path ?? photo.supabase_url
            );
            const { data: signed } = await adminClient.storage
              .from(BUCKET_ID)
              .createSignedUrl(storagePath, 60 * 60 * 24);

            return {
              item_id: photo.item_id as string,
              row: {
                id: photo.id as string,
                storage_path: storagePath,
                signed_url: signed?.signedUrl ?? null,
                created_at: photo.created_at as string,
              },
            };
          })
        );

        photosByItemId = signedRows.reduce((acc, entry) => {
          const key = entry.item_id;
          if (!acc[key]) acc[key] = [];
          acc[key].push(entry.row);
          return acc;
        }, {} as Record<string, Array<{ id: string; storage_path: string; signed_url: string | null; created_at: string }>>);
      }
    }

    const snagsWithPhotos = (snags || []).map((snag) => {
      const template = Array.isArray(snag.checklist_templates)
        ? snag.checklist_templates[0]
        : snag.checklist_templates;

      return {
        ...snag,
        room: template?.room_type || 'Other',
        checklist_item: template?.item_description || 'Unknown Item',
        nhome_photos: photosByItemId[snag.item_id] || [],
      };
    });

    // 6. Group snags by room for easier navigation
    const snagsByRoom = snagsWithPhotos.reduce((acc, snag) => {
      const room = snag.room || 'Other';
      if (!acc[room]) {
        acc[room] = [];
      }
      acc[room].push(snag);
      return acc;
    }, {} as Record<string, typeof snagsWithPhotos>);

    const response = {
      apartment: {
        id: apartment.id,
        unit_number: apartment.unit_number,
      },
      latestInspection: {
        id: latestInspection.id,
        completed_at: latestInspection.completed_at,
        inspection_type: latestInspection.inspection_type,
      },
      snags: snagsWithPhotos,
      snagsByRoom,
      totalSnags: snagsWithPhotos.length,
      criticalCount: snagsWithPhotos.filter((s) => s.status === 'critical').length,
      issueCount: snagsWithPhotos.filter((s) => s.status === 'issue').length,
    };

    console.info('[Portal /apartments/[id]/snags] Snags loaded successfully', {
      apartmentId,
      userId: user.id,
      totalSnags: response.totalSnags,
      criticalCount: response.criticalCount,
      issueCount: response.issueCount,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('[Portal /apartments/[id]/snags] Unexpected error', {
      error: error.message,
      apartmentId,
    });
    return NextResponse.json(
      { error: 'Failed to load snags', detail: error.message },
      { status: 500 }
    );
  }
}
