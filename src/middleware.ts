import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Normalize pathname by removing trailing slashes and ensuring consistent format
 */
function normalizePathname(pathname: string): string {
  // Remove trailing slash, except for root path
  if (pathname.endsWith('/') && pathname.length > 1) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Check if a path is public (doesn't require authentication)
 */
function isPublicPath(pathname: string): boolean {
  // Exact matches for auth routes
  const authPaths = [
    "/auth/signin",
    "/auth/signup",
    "/auth/callback",
  ];

  if (authPaths.includes(pathname)) return true;

  // Static assets and Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/public/") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/workbox-")
  ) {
    return true;
  }

  // API routes (all API routes are public)
  if (pathname.startsWith("/api/")) {
    return true;
  }

  // Everything else requires authentication
  return false;
}

export async function middleware(req: NextRequest) {
  // Normalize the pathname
  const normalizedPathname = normalizePathname(req.nextUrl.pathname);

  console.log('[Middleware] Request:', normalizedPathname, '(original:', req.nextUrl.pathname, ')');

  // Create response object for Supabase SSR
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  // Create Supabase client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on both request and response
          req.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from both request and response
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log('[Middleware] Session exists:', !!session, 'User:', session?.user.email || 'none');

  // Check if path is public
  const isPublic = isPublicPath(normalizedPathname);

  console.log('[Middleware] Path public:', isPublic);

  // Handle root path - redirect based on auth status
  if (normalizedPathname === "/") {
    const redirectUrl = req.nextUrl.clone();
    if (session) {
      // Authenticated user → dashboard
      console.log('[Middleware] Root path - authenticated user, redirecting to /dashboard');
      redirectUrl.pathname = "/dashboard";
    } else {
      // Not authenticated → sign-in
      console.log('[Middleware] Root path - no session, redirecting to /auth/signin');
      redirectUrl.pathname = "/auth/signin";
    }
    redirectUrl.search = ""; // Clear any query params
    return NextResponse.redirect(redirectUrl);
  }

  // Handle authenticated user trying to access sign-in page
  if (session && normalizedPathname === "/auth/signin") {
    console.log('[Middleware] Authenticated user accessing signin - redirecting to /dashboard');
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = ""; // Clear any query params
    return NextResponse.redirect(redirectUrl);
  }

  // Allow public routes
  if (isPublic) {
    console.log('[Middleware] Public route - allowing access');
    return response;
  }

  // Protected route - require authentication
  if (!session) {
    console.log('[Middleware] No session - redirecting to /auth/signin');
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth/signin";
    redirectUrl.searchParams.set("redirectedFrom", normalizedPathname);
    return NextResponse.redirect(redirectUrl);
  }

  // User is authenticated and accessing protected route - allow
  console.log('[Middleware] Authenticated user accessing protected route - allowing');
  return response;
}

// Match all paths
export const config = {
  matcher: ['/:path*'],
};
