import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server/apiAuth';

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

    // 5. Fetch outstanding snags (issue/critical items) with photos
    const { data: snags, error: snagsError } = await supabase
      .from('inspection_results')
      .select(`
        id,
        status,
        notes,
        pt_notes,
        created_at,
        room,
        checklist_item,
        nhome_photos (
          id,
          storage_path,
          public_url,
          created_at
        )
      `)
      .eq('session_id', latestInspection.id)
      .or('status.eq.issue,status.eq.critical')
      .order('room', { ascending: true });

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

    // 6. Group snags by room for easier navigation
    const snagsByRoom = (snags || []).reduce((acc, snag) => {
      const room = snag.room || 'Other';
      if (!acc[room]) {
        acc[room] = [];
      }
      acc[room].push(snag);
      return acc;
    }, {} as Record<string, typeof snags>);

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
      snags: snags || [],
      snagsByRoom,
      totalSnags: snags?.length || 0,
      criticalCount: snags?.filter((s) => s.status === 'critical').length || 0,
      issueCount: snags?.filter((s) => s.status === 'issue').length || 0,
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
