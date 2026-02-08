import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server/apiAuth';

/**
 * Portal endpoint: Get inspection reports for a specific apartment
 *
 * Security - IDOR Prevention:
 * 1. RLS enforcement: Apartment query filtered by company_id
 * 2. Ownership verification: Return 404 if apartment doesn't belong to user's company
 * 3. Cascading security: Inspection sessions also filtered by RLS
 *
 * Returns:
 * - List of completed inspections with report URLs
 * - Portuguese and English PDF reports
 * - Photo package URLs
 * - Inspection metadata (type, dates, inspector)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apartmentId = params.id;

  try {
    // 1. ALWAYS authenticate first
    const { user, profile, supabase } = await requireApiAuth(req);

    console.info('[Portal /apartments/[id]/reports] Loading reports', {
      apartmentId,
      userId: user.id,
      companyId: profile.company_id,
    });

    // 2. Verify apartment belongs to user's company (IDOR protection)
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select(`
        id,
        unit_number,
        apartment_type,
        projects!inner (
          id,
          name
        )
      `)
      .eq('id', apartmentId)
      .maybeSingle();

    if (apartmentError) {
      console.error('[Portal /apartments/[id]/reports] Database error', {
        error: apartmentError.message,
        apartmentId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to load reports', detail: apartmentError.message },
        { status: 500 }
      );
    }

    // 3. IDOR Protection: Return 404 if apartment not found or unauthorized
    if (!apartment) {
      console.warn('[Portal /apartments/[id]/reports] Apartment not found or unauthorized', {
        apartmentId,
        userId: user.id,
        companyId: profile.company_id,
      });
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    // 4. Fetch completed inspections with report URLs
    const { data: inspections, error: inspectionsError } = await supabase
      .from('inspection_sessions')
      .select(`
        id,
        started_at,
        completed_at,
        inspection_type,
        status,
        report_url_pt,
        report_url_en,
        photo_package_url,
        report_generated_at,
        users!inner (
          id,
          email,
          full_name
        )
      `)
      .eq('apartment_id', apartmentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (inspectionsError) {
      console.error('[Portal /apartments/[id]/reports] Failed to load inspections', {
        error: inspectionsError.message,
        apartmentId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to load reports', detail: inspectionsError.message },
        { status: 500 }
      );
    }

    // 5. For each inspection, count snags
    const inspectionsWithStats = await Promise.all(
      (inspections || []).map(async (inspection) => {
        const inspector = Array.isArray(inspection.users)
          ? inspection.users[0]
          : inspection.users;

        const { count: totalItems } = await supabase
          .from('inspection_results')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', inspection.id);

        const { count: issueCount } = await supabase
          .from('inspection_results')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', inspection.id)
          .or('status.eq.issue,status.eq.critical');

        const { count: goodCount } = await supabase
          .from('inspection_results')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', inspection.id)
          .eq('status', 'good');

        return {
          id: inspection.id,
          inspection_type: inspection.inspection_type,
          started_at: inspection.started_at,
          completed_at: inspection.completed_at,
          report_generated_at: inspection.report_generated_at,
          inspector: {
            id: inspector?.id,
            email: inspector?.email,
            name: inspector?.full_name,
          },
          reports: {
            portuguese: inspection.report_url_pt,
            english: inspection.report_url_en,
            photoPackage: inspection.photo_package_url,
          },
          stats: {
            totalItems: totalItems || 0,
            issueCount: issueCount || 0,
            goodCount: goodCount || 0,
          },
        };
      })
    );

    const response = {
      apartment: {
        id: apartment.id,
        unit_number: apartment.unit_number,
        apartment_type: apartment.apartment_type,
        project: apartment.projects,
      },
      inspections: inspectionsWithStats,
      totalInspections: inspectionsWithStats.length,
    };

    console.info('[Portal /apartments/[id]/reports] Reports loaded successfully', {
      apartmentId,
      userId: user.id,
      totalInspections: response.totalInspections,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('[Portal /apartments/[id]/reports] Unexpected error', {
      error: error.message,
      apartmentId,
    });
    return NextResponse.json(
      { error: 'Failed to load reports', detail: error.message },
      { status: 500 }
    );
  }
}
