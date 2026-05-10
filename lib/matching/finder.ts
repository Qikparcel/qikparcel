/**
 * Database queries for finding candidate parcels and trips for matching
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { BIDDING_CONFIG } from '@/lib/bidding/config'

type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

/**
 * Get the set of courier IDs that are excluded from matching for a given parcel.
 * Combines per-parcel exclusions with account-level strike suspensions.
 */
async function getExcludedCourierIdsForParcel(
  supabase: SupabaseClient<Database>,
  parcelId: string
): Promise<Set<string>> {
  const excluded = new Set<string>()

  const { data: parcelExclusions } = await supabase
    .from('parcel_courier_exclusions')
    .select('courier_id')
    .eq('parcel_id', parcelId)

  for (const row of (parcelExclusions ?? []) as Array<{ courier_id: string }>) {
    excluded.add(row.courier_id)
  }

  // Account-level: couriers with active strikes >= threshold within window.
  const sinceIso = new Date(
    Date.now() - BIDDING_CONFIG.strikeWindowDays * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: strikeRows } = await supabase
    .from('courier_strikes')
    .select('courier_id')
    .is('cleared_at', null)
    .gte('created_at', sinceIso)

  if (strikeRows && strikeRows.length > 0) {
    const counts = new Map<string, number>()
    for (const row of strikeRows as Array<{ courier_id: string }>) {
      counts.set(row.courier_id, (counts.get(row.courier_id) ?? 0) + 1)
    }
    for (const [courierId, count] of counts.entries()) {
      if (count >= BIDDING_CONFIG.strikeSuspensionThreshold) {
        excluded.add(courierId)
      }
    }
  }

  return excluded
}

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

  // Skip parcels currently in an active bidding window — they're being handled
  // by the bidding flow until close-handler reverts them to fixed mode.
  const parcelExt = parcel as Parcel & {
    pricing_mode?: 'fixed' | 'bidding'
    bidding_closes_at?: string | null
  }
  if (
    parcelExt.pricing_mode === 'bidding' &&
    parcelExt.bidding_closes_at &&
    new Date(parcelExt.bidding_closes_at).getTime() > Date.now()
  ) {
    console.log(`[FINDER] Parcel ${parcelId} is in active bidding window, skipping auto-match`)
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

  // Per-parcel courier exclusions + account-level strike suspensions
  const excludedCourierIds = await getExcludedCourierIdsForParcel(supabase, parcelId)
  if (excludedCourierIds.size > 0) {
    console.log(
      `[FINDER] Excluding ${excludedCourierIds.size} courier(s) due to parcel exclusion or strike suspension`
    )
  }

  const candidateTrips = ((trips || []) as Trip[]).filter(
    (trip) => !excludedTripIds.has(trip.id) && !excludedCourierIds.has(trip.courier_id)
  )
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

  // Find parcels that are pending and could be matched.
  // Exclude parcels currently in an active bidding window.
  console.log(`[FINDER] Searching for pending parcels to match with trip ${tripId}...`)
  const nowIso = new Date().toISOString()
  const { data: parcels, error: parcelsError } = await supabase
    .from('parcels')
    .select('*')
    .eq('status', 'pending')
    .or(
      `pricing_mode.eq.fixed,bidding_closes_at.is.null,bidding_closes_at.lte.${nowIso}`
    )
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

  // Filter out parcels where this trip's courier is excluded.
  const courierId = trip.courier_id
  const { data: courierExclusions } = await supabase
    .from('parcel_courier_exclusions')
    .select('parcel_id')
    .eq('courier_id', courierId)

  const courierExcludedParcelIds = new Set(
    (courierExclusions as Array<{ parcel_id: string }> | null)?.map((r) => r.parcel_id) ?? []
  )
  if (courierExcludedParcelIds.size > 0) {
    console.log(
      `[FINDER] Excluding ${courierExcludedParcelIds.size} parcel(s) where courier ${courierId} is blocked`
    )
  }

  // If this courier is suspended (3+ active strikes in window), they get no candidates.
  const sinceIso = new Date(
    Date.now() - BIDDING_CONFIG.strikeWindowDays * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: courierStrikes } = await supabase
    .from('courier_strikes')
    .select('id')
    .eq('courier_id', courierId)
    .is('cleared_at', null)
    .gte('created_at', sinceIso)

  if (
    courierStrikes &&
    courierStrikes.length >= BIDDING_CONFIG.strikeSuspensionThreshold
  ) {
    console.log(
      `[FINDER] Courier ${courierId} is suspended (${courierStrikes.length} strikes), returning no candidates`
    )
    return []
  }

  const candidateParcels = ((parcels || []) as Parcel[]).filter(
    (parcel) =>
      !excludedParcelIds.has(parcel.id) &&
      !courierExcludedParcelIds.has(parcel.id)
  )

  console.log(`[FINDER] Returning ${candidateParcels.length} candidate parcels for trip ${tripId}`)
  return candidateParcels
}
