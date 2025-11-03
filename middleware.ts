import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  console.log('[Middleware] Request:', req.nextUrl.pathname);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          const cookieOptions = options ?? {};
          req.cookies.set({ name, value, ...cookieOptions });
          res.cookies.set({ name, value, ...cookieOptions });
        },
        remove(name: string, options: any) {
          const cookieOptions = options ?? {};
          req.cookies.delete({ name, ...cookieOptions });
          res.cookies.delete({ name, ...cookieOptions });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  console.log('[Middleware] Session exists:', !!session, 'Path:', pathname);

  // Define public routes that don't require authentication
  const publicPaths = [
    "/auth/signin",
    "/auth/signup",
    "/auth/microsoft/callback",
    "/auth/callback",
  ];

  // Allow public routes
  const isPublicRoute =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes("/public/");

  if (isPublicRoute) {
    return res;
  }

  // Redirect unauthenticated users to login
  if (!session) {
    console.log('[Middleware] No session - redirecting to /auth/signin');
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/auth/signin";
    // Only set redirectedFrom if it's not already the signin page
    if (pathname !== "/auth/signin") {
      redirectUrl.searchParams.set("redirectedFrom", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated and trying to access signin, redirect to dashboard
  if (session && pathname === "/auth/signin") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

// Match all paths
export const config = {
  matcher: [
    '/(.*)',
  ],
};
