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
  // Status must be 'scheduled' or 'in_progress'
  // AND not locked to another parcel
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .in('status', ['scheduled', 'in_progress'])
    .is('locked_parcel_id', null) // Only trips that are not locked
    .order('created_at', { ascending: false })

  if (tripsError) {
    console.error('Error fetching candidate trips:', tripsError)
    return []
  }

  // Filter out trips that already have this parcel matched
  // (prevent duplicates)
  const { data: existingMatches } = await supabase
    .from('parcel_trip_matches')
    .select('trip_id')
    .eq('parcel_id', parcelId)
    .in('status', ['pending', 'accepted'])

  const excludedTripIds = new Set((existingMatches as Array<{ trip_id: string }> | null)?.map((m) => m.trip_id) || [])

  const candidateTrips = ((trips || []) as Trip[]).filter((trip) => !excludedTripIds.has(trip.id))

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
  const tripData = trip as Trip & { locked_parcel_id?: string | null }
  if (!['scheduled', 'in_progress'].includes(trip.status) || tripData.locked_parcel_id) {
    return []
  }

  // Find parcels that are pending and could be matched
  const { data: parcels, error: parcelsError } = await supabase
    .from('parcels')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (parcelsError) {
    console.error('Error fetching candidate parcels:', parcelsError)
    return []
  }

  // Filter out parcels that already have this trip matched
  // (prevent duplicates)
  const { data: existingMatches } = await supabase
    .from('parcel_trip_matches')
    .select('parcel_id')
    .eq('trip_id', tripId)
    .in('status', ['pending', 'accepted'])

  const excludedParcelIds = new Set((existingMatches as Array<{ parcel_id: string }> | null)?.map((m) => m.parcel_id) || [])

  const candidateParcels = ((parcels || []) as Parcel[]).filter(
    (parcel) => !excludedParcelIds.has(parcel.id)
  )

  return candidateParcels
}
