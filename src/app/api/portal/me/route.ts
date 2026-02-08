import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server/apiAuth';

/**
 * Portal endpoint: Get current user profile and accessible resources
 *
 * Security:
 * - Requires authentication via requireApiAuth
 * - Uses authenticated client (NOT service role)
 * - RLS policies automatically filter apartments by company_id
 *
 * Returns:
 * - User profile (email, role)
 * - Company information
 * - List of accessible apartments (filtered by company via RLS)
 */
export async function GET(req: NextRequest) {
  try {
    // 1. ALWAYS authenticate first - returns authenticated client with RLS enforcement
    const { user, profile, supabase } = await requireApiAuth(req);

    console.info('[Portal /me] Loading user profile', {
      userId: user.id,
      companyId: profile.company_id,
    });

    // 2. Use authenticated client - RLS automatically filters by company/user
    // Fetch company information (RLS: users can only read their own company)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, created_at')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (companyError) {
      console.error('[Portal /me] Failed to load company', {
        error: companyError.message,
        userId: user.id,
        companyId: profile.company_id,
      });
    }

    // Fetch accessible apartments (RLS: automatically filtered to company's apartments)
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select(`
        id,
        unit_number,
        apartment_type,
        floor_number,
        created_at,
        projects!inner (
          id,
          name
        )
      `)
      .order('unit_number', { ascending: true });

    if (apartmentsError) {
      console.error('[Portal /me] Failed to load apartments', {
        error: apartmentsError.message,
        userId: user.id,
        companyId: profile.company_id,
      });
    }

    // Fetch recent inspection sessions for this user
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('inspection_sessions')
      .select(`
        id,
        started_at,
        completed_at,
        status,
        inspection_type,
        apartments!inner (
          unit_number,
          projects!inner (
            name
          )
        )
      `)
      .order('started_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('[Portal /me] Failed to load recent sessions', {
        error: sessionsError.message,
        userId: user.id,
      });
    }

    const response = {
      user: {
        id: user.id,
        email: user.email,
        role: profile.role,
        full_name: profile.full_name,
      },
      company: company || null,
      apartments: apartments || [],
      apartmentsCount: apartments?.length || 0,
      recentSessions: recentSessions || [],
      accessGrantedAt: new Date().toISOString(),
    };

    console.info('[Portal /me] Profile loaded successfully', {
      userId: user.id,
      companyId: profile.company_id,
      apartmentsCount: response.apartmentsCount,
      recentSessionsCount: response.recentSessions.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    // Auth errors are already thrown as NextResponse, so just return them
    if (error instanceof NextResponse) {
      return error;
    }

    console.error('[Portal /me] Unexpected error', {
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Failed to load profile', detail: error.message },
      { status: 500 }
    );
  }
}
