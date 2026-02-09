import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, requireApiAuth, validateUUID } from '@/lib/server/apiAuth';

const REPORT_BUCKET_ID = 'nhome_reports';

function resolveReportPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const stripQuery = (input: string) => input.split('?')[0];

  if (value.startsWith('reports/')) return stripQuery(value);

  const marker = '/nhome_reports/';
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    return stripQuery(value.slice(markerIndex + marker.length));
  }

  return null;
}

/**
 * Portal endpoint: Get detailed information for a specific apartment
 *
 * Security - IDOR Prevention (Three Layers):
 * 1. RLS Policies: Authenticated client automatically filters apartments by company_id
 * 2. Explicit Ownership Check: Query returns null if apartment doesn't belong to user's company
 * 3. Information Leakage Prevention: Return 404 (not 403) for missing/unauthorized apartments
 *
 * This prevents users from:
 * - Tampering with apartment IDs to access other companies' data
 * - Discovering which apartment IDs exist in other companies
 *
 * Returns:
 * - Apartment details (unit, type, floor, etc.)
 * - Project information
 * - Inspection history
 * - Outstanding snags count
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apartmentId = params.id;

  try {
    // 1. ALWAYS authenticate first (prevent endpoint enumeration)
    const { user, profile, supabase } = await requireApiAuth(req);

    // 2. Validate UUID format before making database queries
    validateUUID(apartmentId, "apartment ID");

    console.info('[Portal /apartments/[id]] Loading apartment details', {
      apartmentId,
      userId: user.id,
      companyId: profile.company_id,
    });

    // 3. Use authenticated client - RLS automatically filters by company
    // If apartment doesn't belong to user's company, RLS returns null
    const { data: apartment, error } = await supabase
      .from('apartments')
      .select(`
        id,
        unit_number,
        apartment_type,
        floor_number,
        total_area,
        status,
        created_at,
        projects!inner (
          id,
          name,
          address,
          developer_name,
          project_type
        )
      `)
      .eq('id', apartmentId)
      .maybeSingle();

    if (error) {
      console.error('[Portal /apartments/[id]] Database error', {
        error: error.message,
        apartmentId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to load apartment', detail: error.message },
        { status: 500 }
      );
    }

    // 3. IDOR Protection: Return 404 (not 403) to avoid information leakage
    if (!apartment) {
      console.warn('[Portal /apartments/[id]] Apartment not found or unauthorized', {
        apartmentId,
        userId: user.id,
        companyId: profile.company_id,
      });
      // Return 404 (not 403) so attackers cannot determine if apartment ID exists
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    // Fetch inspection sessions for this apartment (RLS automatically filters)
    const { data: inspections, error: inspectionsError } = await supabase
      .from('inspection_sessions')
      .select(`
        id,
        started_at,
        completed_at,
        status,
        inspection_type,
        report_url_pt,
        report_url_en,
        photo_package_url
      `)
      .eq('apartment_id', apartmentId)
      .order('started_at', { ascending: false });

    if (inspectionsError) {
      console.error('[Portal /apartments/[id]] Failed to load inspections', {
        error: inspectionsError.message,
        apartmentId,
        userId: user.id,
      });
    }

    const adminClient = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    async function signReportUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
      const path = resolveReportPath(pathOrUrl);
      if (!path) return null;
      const { data } = await adminClient.storage
        .from(REPORT_BUCKET_ID)
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? null;
    }

    const inspectionsWithSignedUrls = await Promise.all(
      (inspections || []).map(async (inspection) => ({
        ...inspection,
        report_url_pt: await signReportUrl(inspection.report_url_pt),
        report_url_en: await signReportUrl(inspection.report_url_en),
      }))
    );

    // Count outstanding snags (issues/critical items from latest inspection)
    let outstandingSnags = 0;
    if (inspectionsWithSignedUrls.length > 0) {
      const latestCompletedInspection = inspectionsWithSignedUrls.find((i) => i.status === 'completed');
      if (latestCompletedInspection) {
        const { count } = await supabase
          .from('inspection_results')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', latestCompletedInspection.id)
          .or('status.eq.issue,status.eq.critical');

        outstandingSnags = count || 0;
      }
    }

    const response = {
      apartment: {
        ...apartment,
        stats: {
          totalInspections: inspectionsWithSignedUrls.length,
          completedInspections:
            inspectionsWithSignedUrls.filter((i) => i.status === 'completed').length,
          outstandingSnags,
        },
      },
      inspections: inspectionsWithSignedUrls,
    };

    console.info('[Portal /apartments/[id]] Apartment loaded successfully', {
      apartmentId,
      userId: user.id,
      inspectionsCount: inspectionsWithSignedUrls.length,
      outstandingSnags,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('[Portal /apartments/[id]] Unexpected error', {
      error: error.message,
      apartmentId,
    });
    return NextResponse.json(
      { error: 'Failed to load apartment', detail: error.message },
      { status: 500 }
    );
  }
}
