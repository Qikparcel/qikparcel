import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/callback
 * Handle auth callback from client - sets session cookies server-side
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json()

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Set the session using tokens - this will set cookies properly
    const { data: { session }, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error || !session) {
      console.error('Error setting session in callback:', error)
      return NextResponse.json(
        { error: 'Failed to set session', details: error?.message },
        { status: 400 }
      )
    }

    console.log('Session set successfully in callback:', session.user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Callback error:', error)
    return NextResponse.json(
      { error: 'Callback failed', details: error.message },
      { status: 500 }
    )
  }
}
