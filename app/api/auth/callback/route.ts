import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/callback
 * Handle auth callback from client - sets session cookies server-side
 */
export async function POST(request: NextRequest) {
  console.log('[API CALLBACK] POST /api/auth/callback called')
  console.log('[API CALLBACK] Request origin:', request.nextUrl.origin)
  console.log('[API CALLBACK] Request headers:', {
    'user-agent': request.headers.get('user-agent')?.substring(0, 50),
    'referer': request.headers.get('referer'),
  })

  try {
    const body = await request.json()
    console.log('[API CALLBACK] Request body received:', {
      hasAccessToken: !!body.access_token,
      hasRefreshToken: !!body.refresh_token,
      accessTokenLength: body.access_token?.length || 0,
      refreshTokenLength: body.refresh_token?.length || 0,
    })

    const { access_token, refresh_token } = body

    if (!access_token || !refresh_token) {
      console.error('[API CALLBACK] ERROR: Missing tokens', {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
      })
      return NextResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      )
    }

    console.log('[API CALLBACK] Creating Supabase client...')
    const supabase = createClient()

    // Set the session using tokens - this will set cookies properly
    console.log('[API CALLBACK] Setting session with tokens...')
    const { data: { session }, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error || !session) {
      console.error('[API CALLBACK] ERROR: Failed to set session', {
        error: error?.message,
        errorCode: error?.status,
        hasSession: !!session,
      })
      return NextResponse.json(
        { error: 'Failed to set session', details: error?.message },
        { status: 400 }
      )
    }

    console.log('[API CALLBACK] Session set successfully:', {
      userId: session.user.id,
      userEmail: session.user.email,
      expiresAt: session.expires_at,
    })

    // Verify cookies are being set
    const cookies = request.cookies.getAll()
    console.log('[API CALLBACK] Current cookies:', cookies.map(c => c.name))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API CALLBACK] EXCEPTION:', {
      message: error.message,
      stack: error.stack,
      error: error,
    })
    return NextResponse.json(
      { error: 'Callback failed', details: error.message },
      { status: 500 }
    )
  }
}
