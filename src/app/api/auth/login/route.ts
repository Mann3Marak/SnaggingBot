import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { enforceRateLimit } from '@/lib/server/rateLimit';

/**
 * Test authentication endpoint for security tests
 *
 * In production, authentication happens client-side via Supabase.
 * This endpoint exists solely to support automated security testing.
 *
 * Usage:
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Returns: { token: string, user: { id, email } }
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await enforceRateLimit(req, {
      keyPrefix: 'auth-login',
      windowMs: 60_000,
      max: 20,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create Supabase client for authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.warn('[Auth /login] Authentication failed', {
        error: error.message,
      });
      return NextResponse.json(
        { error: 'Invalid credentials', detail: error.message },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: 'Authentication failed - no session created' },
        { status: 401 }
      );
    }

    logger.info('[Auth /login] User authenticated successfully', {
      userId: data.user.id,
    });

    // Return access token for testing
    return NextResponse.json({
      token: data.session.access_token,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error: any) {
    logger.error('[Auth /login] Unexpected error', {
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Authentication failed', detail: error.message },
      { status: 500 }
    );
  }
}
