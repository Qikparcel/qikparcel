import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

/**
 * GET /api/admin/users/[id]/data
 * Get user details including parcels and trips (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const supabase = createClient()

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase service role key')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const adminClient = createAdminClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get user profile
    const { data: userProfile, error: userError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<Profile>()

    if (userError || !userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user's parcels (if sender or admin)
    const { data: parcels, error: parcelsError } = await adminClient
      .from('parcels')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })

    if (parcelsError) {
      console.error('Error fetching parcels:', parcelsError)
    }

    // Get user's trips (if courier or admin)
    const { data: trips, error: tripsError } = await adminClient
      .from('trips')
      .select('*')
      .eq('courier_id', userId)
      .order('created_at', { ascending: false })

    if (tripsError) {
      console.error('Error fetching trips:', tripsError)
    }

    return NextResponse.json({
      success: true,
      user: userProfile,
      parcels: parcels || [],
      trips: trips || [],
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/users/[id]/data:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
