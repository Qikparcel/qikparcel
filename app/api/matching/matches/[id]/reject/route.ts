import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Match = Database['public']['Tables']['parcel_trip_matches']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

/**
 * POST /api/matching/matches/[id]/reject
 * Courier rejects a match
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id
    const supabase = createClient()

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the match with trip details
    const { data: match, error: matchError } = await supabase
      .from('parcel_trip_matches')
      .select(
        `
        *,
        trip:trips!parcel_trip_matches_trip_id_fkey(
          id,
          courier_id
        )
      `
      )
      .eq('id', matchId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const matchData = match as any
    const trip = matchData.trip as Trip

    // Verify user is the courier of this trip
    if (trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Only the trip courier can reject matches' },
        { status: 403 }
      )
    }

    // Verify match is still pending
    if ((match as Match).status !== 'pending') {
      return NextResponse.json(
        { error: 'Match is not pending (already accepted or rejected)' },
        { status: 400 }
      )
    }

    // Update match status to rejected
    const { error: updateError } = await (supabase
      .from('parcel_trip_matches') as any)
      .update({
        status: 'rejected',
      })
      .eq('id', matchId)

    if (updateError) {
      console.error('Error updating match status:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject match', details: updateError.message },
        { status: 500 }
      )
    }

    // Parcel status remains 'pending' so it can be matched with other trips

    return NextResponse.json({
      success: true,
      message: 'Match rejected successfully',
      match: {
        id: matchId,
        status: 'rejected',
      },
    })
  } catch (error: any) {
    console.error('Error in POST /api/matching/matches/[id]/reject:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
