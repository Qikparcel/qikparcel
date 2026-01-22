/**
 * Database queries for finding candidate parcels and trips for matching
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

/**
 * Find candidate trips that could match a given parcel
 * Returns trips that are:
 * - Status: scheduled or in_progress
 * - Not already matched (or can accept more parcels)
 */
export async function findCandidateTripsForParcel(
  supabase: SupabaseClient<Database>,
  parcelId: string
): Promise<Trip[]> {
  // Get parcel first to check its status
  const { data: parcel, error: parcelError } = await supabase
    .from('parcels')
    .select('*')
    .eq('id', parcelId)
    .single<Parcel>()

  if (parcelError || !parcel) {
    console.error('Error fetching parcel for matching:', parcelError)
    return []
  }

  // Only match pending parcels
  if (parcel.status !== 'pending') {
    return []
  }

  // Find trips that are available for matching
  // Status: scheduled or in_progress, not locked to another parcel (migration 011)
  console.log(`[FINDER] Searching for trips to match with parcel ${parcelId}...`)
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .in('status', ['scheduled', 'in_progress'])
    .is('locked_parcel_id', null)
    .order('created_at', { ascending: false })

  if (tripsError) {
    console.error('[FINDER] Error fetching candidate trips:', tripsError)
    return []
  }

  console.log(`[FINDER] Found ${trips?.length || 0} total eligible trips (scheduled/in_progress, unlocked)`)

  // Filter out trips that already have this parcel matched (prevent duplicates)
  const { data: existingMatches } = await supabase
    .from('parcel_trip_matches')
    .select('trip_id')
    .eq('parcel_id', parcelId)
    .in('status', ['pending', 'accepted'])

  const excludedTripIds = new Set((existingMatches as Array<{ trip_id: string }> | null)?.map((m) => m.trip_id) || [])
  console.log(`[FINDER] Excluding ${excludedTripIds.size} trips that already have matches with this parcel`)

  const candidateTrips = ((trips || []) as Trip[]).filter((trip) => !excludedTripIds.has(trip.id))
  console.log(`[FINDER] Returning ${candidateTrips.length} candidate trips for parcel ${parcelId}`)
  return candidateTrips
}

/**
 * Find candidate parcels that could match a given trip
 * Returns parcels that are:
 * - Status: pending
 * - Not already matched to this trip
 */
export async function findCandidateParcelsForTrip(
  supabase: SupabaseClient<Database>,
  tripId: string
): Promise<Parcel[]> {
  // Get trip first to check its status
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single<Trip>()

  if (tripError || !trip) {
    console.error('Error fetching trip for matching:', tripError)
    return []
  }

  // Only match with scheduled or in_progress trips that are not locked
  // (locked_parcel_id may not exist if migration 011 hasn't run - treat as undefined/falsy)
  const tripData = trip as Trip & { locked_parcel_id?: string | null }
  if (!['scheduled', 'in_progress'].includes(trip.status)) {
    return []
  }
  if (tripData.locked_parcel_id) {
    return []
  }

  // Find parcels that are pending and could be matched
  console.log(`[FINDER] Searching for pending parcels to match with trip ${tripId}...`)
  const { data: parcels, error: parcelsError } = await supabase
    .from('parcels')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (parcelsError) {
    console.error('[FINDER] Error fetching candidate parcels:', parcelsError)
    return []
  }

  console.log(`[FINDER] Found ${parcels?.length || 0} total pending parcels`)

  // Filter out parcels that already have this trip matched
  // (prevent duplicates)
  const { data: existingMatches } = await supabase
    .from('parcel_trip_matches')
    .select('parcel_id')
    .eq('trip_id', tripId)
    .in('status', ['pending', 'accepted'])

  const excludedParcelIds = new Set((existingMatches as Array<{ parcel_id: string }> | null)?.map((m) => m.parcel_id) || [])
  console.log(`[FINDER] Excluding ${excludedParcelIds.size} parcels that already have matches with this trip`)

  const candidateParcels = ((parcels || []) as Parcel[]).filter(
    (parcel) => !excludedParcelIds.has(parcel.id)
  )

  console.log(`[FINDER] Returning ${candidateParcels.length} candidate parcels for trip ${tripId}`)
  return candidateParcels
}
