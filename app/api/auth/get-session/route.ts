import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/get-session
 * Get current user session (for client-side use after callback)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to get session', details: error.message },
        { status: 400 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        phone: session.user.phone,
      },
    })
  } catch (error: any) {
    console.error('Get session error:', error)
    return NextResponse.json(
      { error: 'Failed to get session', details: error.message },
      { status: 500 }
    )
  }
}




