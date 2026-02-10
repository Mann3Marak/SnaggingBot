import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server/apiAuth';

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Portal endpoint: List apartments accessible to the authenticated user
 *
 * Security:
 * - Requires authentication via requireApiAuth
 * - Uses authenticated client (NOT service role)
 * - RLS policies automatically filter apartments by company_id
 * - No IDOR vulnerability: users can only see their company's apartments
 *
 * Returns:
 * - List of apartments with project information
 * - Filtered by company via RLS (users cannot access other companies' data)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. ALWAYS authenticate first
    const { user, profile, supabase } = await requireApiAuth(req);

    console.info('[Portal /apartments/list] Loading apartments', {
      userId: user.id,
      companyId: profile.company_id,
    });

    // 2. Use authenticated client - RLS automatically filters by company
    const { data: apartments, error } = await supabase
      .from('apartments')
      .select(`
        id,
        unit_number,
        apartment_type,
        floor_number,
        created_at,
        projects!inner (
          id,
          name,
          address,
          developer_name
        )
      `)
      .order('unit_number', { ascending: true });

    if (error) {
      console.error('[Portal /apartments/list] Failed to load apartments', {
        error: error.message,
        userId: user.id,
        companyId: profile.company_id,
      });
      return NextResponse.json(
        { error: 'Failed to load apartments', detail: error.message },
        { status: 500 }
      );
    }

    // For each apartment, fetch inspection summary
    const apartmentsWithStats = await Promise.all(
      (apartments || []).map(async (apt) => {
        // Count inspection sessions for this apartment
        const { count: totalInspections } = await supabase
          .from('inspection_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('apartment_id', apt.id);

        // Count completed inspections
        const { count: completedInspections } = await supabase
          .from('inspection_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('apartment_id', apt.id)
          .eq('status', 'completed');

        // Get latest inspection
        const { data: latestInspection } = await supabase
          .from('inspection_sessions')
          .select('id, started_at, completed_at, status, inspection_type')
          .eq('apartment_id', apt.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...apt,
          stats: {
            totalInspections: totalInspections || 0,
            completedInspections: completedInspections || 0,
            latestInspection: latestInspection || null,
          },
        };
      })
    );

    console.info('[Portal /apartments/list] Apartments loaded successfully', {
      userId: user.id,
      companyId: profile.company_id,
      apartmentsCount: apartmentsWithStats.length,
    });

    return NextResponse.json({
      apartments: apartmentsWithStats,
      count: apartmentsWithStats.length,
    });
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('[Portal /apartments/list] Unexpected error', {
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Failed to load apartments', detail: error.message },
      { status: 500 }
    );
  }
}
