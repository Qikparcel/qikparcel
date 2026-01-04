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
    console.error('[MIDDLEWARE] Missing Supabase environment variables')
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

  const pathname = req.nextUrl.pathname

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('[MIDDLEWARE]', {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id,
  })

  // Protect dashboard and other authenticated routes
  if (pathname.startsWith('/dashboard') && !session) {
    console.log('[MIDDLEWARE] Redirecting to /login (no session for dashboard)')
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if ((pathname === '/login' || pathname === '/signup') && session) {
    console.log('[MIDDLEWARE] Redirecting to /dashboard (session exists on auth page)')
    const dashboardUrl = new URL('/dashboard', req.url)
    return NextResponse.redirect(dashboardUrl)
  }

  // Role-based route protection for dashboard routes
  if (pathname.startsWith('/dashboard') && session) {
    try {
      // Get user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) {
        console.error('[MIDDLEWARE] Error fetching profile:', profileError)
        // Allow to proceed - profile might not exist yet, let the page handle it
        return response
      }

      const userRole = profile.role

      // Sender-only routes
      if (pathname.startsWith('/dashboard/parcels')) {
        if (userRole !== 'sender') {
          console.log('[MIDDLEWARE] Blocking access to /dashboard/parcels - user is not a sender', { userRole })
          const dashboardUrl = new URL('/dashboard', req.url)
          return NextResponse.redirect(dashboardUrl)
        }
      }

      // Courier-only routes
      if (pathname.startsWith('/dashboard/trips')) {
        if (userRole !== 'courier') {
          console.log('[MIDDLEWARE] Blocking access to /dashboard/trips - user is not a courier', { userRole })
          const dashboardUrl = new URL('/dashboard', req.url)
          return NextResponse.redirect(dashboardUrl)
        }
      }

      // API route role protection
      if (pathname.startsWith('/api/parcels')) {
        if (userRole !== 'sender') {
          console.log('[MIDDLEWARE] Blocking API access to /api/parcels - user is not a sender', { userRole })
          return NextResponse.json(
            { error: 'Forbidden: Only senders can access parcel routes' },
            { status: 403 }
          )
        }
      }

      if (pathname.startsWith('/api/trips')) {
        if (userRole !== 'courier') {
          console.log('[MIDDLEWARE] Blocking API access to /api/trips - user is not a courier', { userRole })
          return NextResponse.json(
            { error: 'Forbidden: Only couriers can access trip routes' },
            { status: 403 }
          )
        }
      }

      console.log('[MIDDLEWARE] Role check passed', { pathname, userRole })
    } catch (error) {
      console.error('[MIDDLEWARE] Error in role check:', error)
      // Allow to proceed - error will be handled by the route
    }
  }

  console.log('[MIDDLEWARE] Allowing request to proceed')

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/parcels/:path*',
    '/api/trips/:path*',
    '/login',
    '/signup',
  ],
}
