import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Match = Database['public']['Tables']['parcel_trip_matches']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

/**
 * GET /api/matching/parcels/[id]/matches
 * Get all matches for a specific parcel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parcelId = params.id
    const supabase = createClient()

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view this parcel
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('sender_id')
      .eq('id', parcelId)
      .single()

    if (parcelError || !parcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    const parcelData = parcel as { sender_id: string }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only sender of parcel or admin can view matches
    if (profile.role !== 'admin' && parcelData.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot view matches for this parcel' },
        { status: 403 }
      )
    }

    // Get matches for this parcel with trip details
    // Use the foreign key relationship properly
    const { data: matches, error: matchesError } = await supabase
      .from('parcel_trip_matches')
      .select(
        `
        *,
        trip:trips!parcel_trip_matches_trip_id_fkey(
          id,
          courier_id,
          origin_address,
          destination_address,
          departure_time,
          estimated_arrival,
          status,
          available_capacity,
          courier:profiles!trips_courier_id_fkey(
            id,
            full_name,
            phone_number,
            whatsapp_number
          )
        )
      `
      )
      .eq('parcel_id', parcelId)
      .in('status', ['pending', 'accepted'])
      .order('match_score', { ascending: false })

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json(
        { error: 'Failed to fetch matches', details: matchesError.message },
        { status: 500 }
      )
    }

    // Process matches to ensure trip is a single object, not an array
    const processedMatches = (matches || []).map((match: any) => {
      // Handle case where Supabase returns trip as an array
      if (match.trip && Array.isArray(match.trip)) {
        match.trip = match.trip[0] || null
      }
      return match
    })

    return NextResponse.json({
      success: true,
      matches: processedMatches,
    })
  } catch (error: any) {
    console.error('Error in GET /api/matching/parcels/[id]/matches:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
