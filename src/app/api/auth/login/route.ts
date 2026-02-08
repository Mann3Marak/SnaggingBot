import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      console.error('[Auth /login] Authentication failed', {
        email,
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

    console.info('[Auth /login] User authenticated successfully', {
      userId: data.user.id,
      email: data.user.email,
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
    console.error('[Auth /login] Unexpected error', {
      error: error.message,
    });
    return NextResponse.json(
      { error: 'Authentication failed', detail: error.message },
      { status: 500 }
    );
  }
}
