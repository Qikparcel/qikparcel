import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    
    // Create Supabase client with proper cookie handling
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            // This will be handled by the response
          },
        },
      }
    )

    // Sign out the user - this should clear the session
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      // Continue to clear cookies even if signOut has an error
    }

    // Create response that clears all auth cookies
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully' 
    }, { status: 200 })

    // Clear all Supabase auth cookies
    const allCookies = cookieStore.getAll()
    allCookies.forEach((cookie) => {
      // Supabase cookies typically start with 'sb-' followed by project ref
      if (cookie.name.includes('sb-') || cookie.name.includes('supabase')) {
        response.cookies.set(cookie.name, '', {
          expires: new Date(0),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
        response.cookies.delete(cookie.name)
      }
    })

    // Also clear any other potential auth cookies
    const authCookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'sb-auth-token',
    ]

    authCookieNames.forEach((cookieName) => {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      response.cookies.delete(cookieName)
    })

    return response
  } catch (error: any) {
    console.error('Error in logout route:', error)
    
    // Even on error, try to clear cookies
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out (with errors)' 
    }, { status: 200 })

    // Clear all Supabase cookies
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    allCookies.forEach((cookie) => {
      if (cookie.name.includes('sb-') || cookie.name.includes('supabase')) {
        response.cookies.set(cookie.name, '', {
          expires: new Date(0),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        })
        response.cookies.delete(cookie.name)
      }
    })

    return response
  }
}
