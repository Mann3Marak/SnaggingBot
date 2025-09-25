import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res }) as any
  const { data: { session } } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname
  const needsAuth = path.startsWith('/dashboard') || path.startsWith('/inspection') || path.startsWith('/reports') || path.startsWith('/admin')

  if (needsAuth && !session) {
    const redirectUrl = new URL('/auth/signin', req.url)
    redirectUrl.searchParams.set('message', 'Please sign in to access NHome Inspection Pro')
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = { matcher: ['/dashboard/:path*', '/inspection/:path*', '/reports/:path*', '/admin/:path*'] }
