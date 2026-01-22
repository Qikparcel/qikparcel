import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

type Profile = Database['public']['Tables']['profiles']['Row']

export async function GET(request: NextRequest) {
  try {
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

    // Get match statistics
    const [totalMatches, pendingMatches, acceptedMatches, rejectedMatches] = await Promise.all([
      adminClient.from('parcel_trip_matches').select('*', { count: 'exact', head: true }),
      adminClient.from('parcel_trip_matches').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      adminClient.from('parcel_trip_matches').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
      adminClient.from('parcel_trip_matches').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ])

    // Get recent matches with details
    const { data: recentMatches } = await adminClient
      .from('parcel_trip_matches')
      .select(`
        *,
        parcel:parcels!parcel_trip_matches_parcel_id_fkey(
          id,
          pickup_address,
          delivery_address,
          status,
          sender:profiles!parcels_sender_id_fkey(
            id,
            full_name,
            phone_number
          )
        ),
        trip:trips!parcel_trip_matches_trip_id_fkey(
          id,
          origin_address,
          destination_address,
          status,
          courier:profiles!trips_courier_id_fkey(
            id,
            full_name,
            phone_number
          )
        )
      `)
      .order('matched_at', { ascending: false })
      .limit(20)

    // Normalize matches - Supabase might return arrays for foreign key relationships
    const normalizedMatches = (recentMatches || []).map((match: any) => {
      // Normalize parcel if it's an array
      if (match.parcel && Array.isArray(match.parcel)) {
        match.parcel = match.parcel[0] || null
      }
      // Normalize trip if it's an array
      if (match.trip && Array.isArray(match.trip)) {
        match.trip = match.trip[0] || null
      }
      // Normalize sender if it's an array
      if (match.parcel?.sender && Array.isArray(match.parcel.sender)) {
        match.parcel.sender = match.parcel.sender[0] || null
      }
      // Normalize courier if it's an array
      if (match.trip?.courier && Array.isArray(match.trip.courier)) {
        match.trip.courier = match.trip.courier[0] || null
      }
      return match
    })

    return NextResponse.json({
      success: true,
      stats: {
        total: totalMatches.count || 0,
        pending: pendingMatches.count || 0,
        accepted: acceptedMatches.count || 0,
        rejected: rejectedMatches.count || 0,
      },
      recentMatches: normalizedMatches,
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/matches:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
