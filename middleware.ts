import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // Create Supabase client for middleware
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in middleware')
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        req.cookies.set({
          name,
          value,
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: req.headers,
          },
        })
        response.cookies.set({
          name,
          value,
          ...options,
        })
      },
      remove(name: string, options: any) {
        req.cookies.set({
          name,
          value: '',
          ...options,
        })
        response = NextResponse.next({
          request: {
            headers: req.headers,
          },
        })
        response.cookies.set({
          name,
          value: '',
          ...options,
        })
      },
    },
  })

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('[MIDDLEWARE]', {
    pathname: req.nextUrl.pathname,
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
  })

  // Protect dashboard and other authenticated routes
  if (req.nextUrl.pathname.startsWith('/dashboard') && !session) {
    console.log('[MIDDLEWARE] Redirecting to /login (no session for dashboard)')
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') && session) {
    console.log('[MIDDLEWARE] Redirecting to /dashboard (session exists on auth page)')
    const dashboardUrl = new URL('/dashboard', req.url)
    return NextResponse.redirect(dashboardUrl)
  }

  console.log('[MIDDLEWARE] Allowing request to proceed')

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
