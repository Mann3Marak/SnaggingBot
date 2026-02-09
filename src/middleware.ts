import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { logger } from "@/lib/logger";

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
  // Any request for a file (e.g. .png/.jpg/.js/.css/.map/.ico) should bypass auth middleware.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;

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

  logger.debug("[Middleware] Request", { pathname: normalizedPathname });

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

  logger.debug("[Middleware] Session lookup", { hasSession: !!session });

  // Check if path is public
  const isPublic = isPublicPath(normalizedPathname);

  logger.debug("[Middleware] Route visibility", { isPublic });

  // Handle root path - redirect based on auth status
  if (normalizedPathname === "/") {
    const redirectUrl = req.nextUrl.clone();
    if (session) {
      // Authenticated user → dashboard
      logger.debug("[Middleware] Redirecting root to dashboard");
      redirectUrl.pathname = "/dashboard";
    } else {
      // Not authenticated → sign-in
      logger.debug("[Middleware] Redirecting root to sign-in");
      redirectUrl.pathname = "/auth/signin";
    }
    redirectUrl.search = ""; // Clear any query params
    return NextResponse.redirect(redirectUrl);
  }

  // Handle authenticated user trying to access sign-in page
  if (session && normalizedPathname === "/auth/signin") {
    logger.debug("[Middleware] Redirecting authenticated user away from sign-in");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = ""; // Clear any query params
    return NextResponse.redirect(redirectUrl);
  }

  // Allow public routes
  if (isPublic) {
    logger.debug("[Middleware] Allowing public route");
    return response;
  }

  // Protected route - require authentication
  if (!session) {
    logger.debug("[Middleware] Redirecting unauthenticated request to sign-in");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth/signin";
    redirectUrl.searchParams.set("redirectedFrom", normalizedPathname);
    return NextResponse.redirect(redirectUrl);
  }

  // User is authenticated and accessing protected route - allow
  logger.debug("[Middleware] Allowing authenticated request");
  return response;
}

// Match all paths
export const config = {
  matcher: [
    // Skip Next internals and common static asset files.
    '/((?!_next/static|_next/image|favicon.ico|sw.js|workbox-).*)',
  ],
};
