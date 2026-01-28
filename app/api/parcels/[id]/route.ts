import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'
import { findAndCreateMatchesForParcel } from '@/lib/matching/service'
import { calculateMatchScore } from '@/lib/matching/scoring'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type ParcelUpdate = Database['public']['Tables']['parcels']['Update']
type Trip = Database['public']['Tables']['trips']['Row']
type Match = Database['public']['Tables']['parcel_trip_matches']['Row']

const MIN_SCORE_THRESHOLD = parseInt(process.env.MATCHING_MIN_SCORE_THRESHOLD || '60', 10) // Minimum score threshold: 60%

/**
 * GET /api/parcels/[id]
 * Get a specific parcel by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const parcelId = params.id

    // Get parcel
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('*')
      .eq('id', parcelId)
      .single<Parcel>()

    if (parcelError || !parcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    // Sender can view their own parcel, courier can view parcels matched to their trips
    if (profile?.role === 'sender' && parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view this parcel' },
        { status: 403 }
      )
    }

    // If courier, verify parcel is matched to one of their trips
    if (profile?.role === 'courier' && parcel.matched_trip_id) {
      const { data: trip } = await supabase
        .from('trips')
        .select('courier_id')
        .eq('id', parcel.matched_trip_id)
        .single<Pick<Trip, 'courier_id'>>()
      
      if (trip && trip.courier_id !== session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized to view this parcel' },
          { status: 403 }
        )
      }
    } else if (profile?.role === 'courier' && !parcel.matched_trip_id) {
      return NextResponse.json(
        { error: 'Unauthorized to view this parcel' },
        { status: 403 }
      )
    }

    // Get status history
    const { data: statusHistory, error: historyError } = await supabase
      .from('parcel_status_history')
      .select('*')
      .eq('parcel_id', parcelId)
      .order('created_at', { ascending: true })

    if (historyError) {
      console.error('Error fetching status history:', historyError)
    }

    return NextResponse.json({
      success: true,
      parcel,
      statusHistory: statusHistory || [],
    })
  } catch (error: any) {
    console.error('Error in GET /api/parcels/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/parcels/[id]
 * Update a parcel
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const parcelId = params.id

    // Get existing parcel to verify ownership and check matched_trip_id
    const { data: existingParcel, error: parcelError } = await supabase
      .from('parcels')
      .select('sender_id, status, matched_trip_id')
      .eq('id', parcelId)
      .single<Pick<Parcel, 'sender_id' | 'status' | 'matched_trip_id'>>()

    if (parcelError || !existingParcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    // Only sender can update their own parcel
    if (existingParcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this parcel' },
        { status: 403 }
      )
    }

    // Only allow editing if parcel is in pending state
    if (existingParcel.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only edit parcels in pending state' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      description,
      weight_kg,
      dimensions,
      estimated_value,
      estimated_value_currency,
    } = body

    // Validate required fields
    if (!pickup_address || !delivery_address) {
      return NextResponse.json(
        { error: 'Pickup and delivery addresses are required' },
        { status: 400 }
      )
    }

    // Normalize address for comparison
    const normalizeAddress = (address: string): string => {
      return address
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s,]/g, '')
    }

    const areAddressesSame = (address1: string, address2: string): boolean => {
      return normalizeAddress(address1) === normalizeAddress(address2)
    }

    // Validate that pickup and delivery addresses are different
    if (areAddressesSame(pickup_address, delivery_address)) {
      return NextResponse.json(
        { error: 'Pickup and delivery addresses cannot be the same' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: ParcelUpdate & { estimated_value_currency?: string | null } = {
      pickup_address,
      pickup_latitude: pickup_latitude || null,
      pickup_longitude: pickup_longitude || null,
      delivery_address,
      delivery_latitude: delivery_latitude || null,
      delivery_longitude: delivery_longitude || null,
      description: description || null,
      weight_kg: weight_kg || null,
      dimensions: dimensions || null,
      estimated_value: estimated_value || null,
      estimated_value_currency: estimated_value_currency || null,
      updated_at: new Date().toISOString(),
    }

    // Update parcel
    const { data: updatedParcel, error: updateError } = await supabase
      .from('parcels')
      // @ts-expect-error - Supabase update method type inference issue
      .update(updateData)
      .eq('id', parcelId)
      .select()
      .single<Parcel>()

    if (updateError) {
      console.error('Error updating parcel:', updateError)
      return NextResponse.json(
        { error: 'Failed to update parcel', details: updateError.message },
        { status: 500 }
      )
    }

    // If parcel was matched, invalidate existing matches and clear matched_trip_id
    // Only if parcel is still in 'pending' status (can't change matched/accepted parcels)
    if (existingParcel.status === 'pending') {
      const adminClient = createSupabaseAdminClient()
      
      // Clear matched_trip_id if it was set
      if (existingParcel.matched_trip_id) {
        console.log(`[PARCEL UPDATE] Clearing matched_trip_id for parcel ${parcelId} due to update`)
        await (adminClient.from('parcels') as any)
          .update({ matched_trip_id: null })
          .eq('id', parcelId)
      }

      // Invalidate existing pending matches (delete them so they can be re-created with new scores)
      const { error: deleteMatchesError } = await adminClient
        .from('parcel_trip_matches')
        .delete()
        .eq('parcel_id', parcelId)
        .eq('status', 'pending')

      if (deleteMatchesError) {
        console.error(`[PARCEL UPDATE] Error deleting pending matches:`, deleteMatchesError)
      } else {
        console.log(`[PARCEL UPDATE] Invalidated pending matches for parcel ${parcelId}`)
      }

      // For accepted matches, re-score them to see if they're still valid
      // If score drops below threshold, mark as expired
      const { data: acceptedMatches, error: acceptedMatchesError } = await adminClient
        .from('parcel_trip_matches')
        .select('id, trip_id, trips(*)')
        .eq('parcel_id', parcelId)
        .eq('status', 'accepted') as { data: Array<{ id: string; trip_id: string; trips: Trip }> | null; error: any }

      if (acceptedMatchesError) {
        console.error(`[PARCEL UPDATE] Error fetching accepted matches:`, acceptedMatchesError)
      } else if (acceptedMatches && acceptedMatches.length > 0) {
        console.log(`[PARCEL UPDATE] Re-scoring ${acceptedMatches.length} accepted matches`)
        
        for (const match of acceptedMatches) {
          const trip = match.trips
          if (!trip) {
            console.warn(`[PARCEL UPDATE] Match ${match.id} has no associated trip, skipping`)
            continue
          }
          
          const newScore = calculateMatchScore(updatedParcel, trip)
          console.log(`[PARCEL UPDATE] Match ${match.id} new score: ${newScore} (threshold: ${MIN_SCORE_THRESHOLD})`)
          
          // If score drops below threshold, expire the match
          if (newScore < MIN_SCORE_THRESHOLD) {
            console.log(`[PARCEL UPDATE] Expiring accepted match ${match.id} - score dropped to ${newScore}`)
            await (adminClient.from('parcel_trip_matches') as any)
              .update({ status: 'expired' })
              .eq('id', match.id)
            
            // Clear matched_trip_id if this was the matched trip
            if (updatedParcel.matched_trip_id === trip.id) {
              await (adminClient.from('parcels') as any)
                .update({ matched_trip_id: null })
                .eq('id', parcelId)
            }
          } else {
            // Update the match score even if still valid
            await (adminClient.from('parcel_trip_matches') as any)
              .update({ match_score: newScore })
              .eq('id', match.id)
            console.log(`[PARCEL UPDATE] Updated match ${match.id} score to ${newScore}`)
          }
        }
      }
    }

    // Trigger matching after parcel update (async, don't block response)
    console.log(`[PARCEL UPDATE] Triggering matching for updated parcel: ${parcelId}`)
    const adminClient = createSupabaseAdminClient()
    findAndCreateMatchesForParcel(adminClient, parcelId)
      .then((result) => {
        console.log(
          `[PARCEL UPDATE] ✅ Matching completed for parcel ${parcelId}: ${result.created} matches created`
        )
      })
      .catch((error) => {
        console.error(
          `[PARCEL UPDATE] ❌ Error triggering matching for parcel ${parcelId}:`,
          error
        )
      })

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
    })
  } catch (error: any) {
    console.error('Error in PUT /api/parcels/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


