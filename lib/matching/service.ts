/**
 * Core matching service - orchestrates the matching process
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { calculateMatchScore, isMatchValid } from './scoring'
import {
  findCandidateTripsForParcel,
  findCandidateParcelsForTrip,
} from './finder'
import { notifyCourierOfMatch } from './notifications'

type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']
type Match = Database['public']['Tables']['parcel_trip_matches']['Insert']

const MIN_SCORE_THRESHOLD =
  parseInt(process.env.MATCHING_MIN_SCORE_THRESHOLD || '60', 10)

/**
 * Find and create matches for a parcel
 * Called when a new parcel is created
 */
export async function findAndCreateMatchesForParcel(
  supabase: SupabaseClient<Database>,
  parcelId: string
): Promise<{ created: number; matches: Match[] }> {
  console.log(`[MATCHING] Finding matches for parcel: ${parcelId}`)

  // Get the parcel
  const { data: parcel, error: parcelError } = await supabase
    .from('parcels')
    .select('*')
    .eq('id', parcelId)
    .single<Parcel>()

  if (parcelError || !parcel) {
    console.error(`[MATCHING] Error fetching parcel ${parcelId}:`, parcelError)
    return { created: 0, matches: [] }
  }

  // Find candidate trips
  const candidateTrips = await findCandidateTripsForParcel(supabase, parcelId)
  console.log(
    `[MATCHING] Found ${candidateTrips.length} candidate trips for parcel ${parcelId}`
  )

  const createdMatches: Match[] = []

  // Score each candidate trip
  for (const trip of candidateTrips) {
    const score = calculateMatchScore(parcel, trip)

    console.log(
      `[MATCHING] Parcel ${parcelId} <-> Trip ${trip.id}: Score ${score} (threshold: ${MIN_SCORE_THRESHOLD})`
    )

    // Only create match if score meets threshold
    if (isMatchValid(score, MIN_SCORE_THRESHOLD)) {
      const match: Match = {
        parcel_id: parcelId,
        trip_id: trip.id,
        match_score: score,
        status: 'pending',
      }

      // Try to create match record (handle unique constraint if exists)
      const { data: createdMatch, error: matchError } = await (supabase
        .from('parcel_trip_matches') as any)
        .insert(match)
        .select()
        .single()

      if (matchError) {
        // If unique constraint violation, match already exists - skip
        if (matchError.code === '23505') {
          console.log(
            `[MATCHING] Match already exists for parcel ${parcelId} and trip ${trip.id}`
          )
        } else {
          console.error(
            `[MATCHING] Error creating match for parcel ${parcelId} and trip ${trip.id}:`,
            matchError
          )
        }
      } else {
        console.log(
          `[MATCHING] Created match: ${createdMatch.id} (Score: ${score})`
        )
        createdMatches.push(createdMatch as Match)

        // Notify courier of the new match (async, don't block)
        console.log(`[MATCHING] Triggering notification for match ${createdMatch.id}`)
        notifyCourierOfMatch(supabase, createdMatch.id)
          .then(() => {
            console.log(`[MATCHING] ✅ Notification completed for match ${createdMatch.id}`)
          })
          .catch((error) => {
            console.error(
              `[MATCHING] ❌ Error notifying courier of match ${createdMatch.id}:`,
              error
            )
            console.error(`[MATCHING] Notification error stack:`, error.stack)
          })
      }
    }
  }

  console.log(
    `[MATCHING] Created ${createdMatches.length} matches for parcel ${parcelId}`
  )

  return { created: createdMatches.length, matches: createdMatches }
}

/**
 * Find and create matches for a trip
 * Called when a new trip is created
 */
export async function findAndCreateMatchesForTrip(
  supabase: SupabaseClient<Database>,
  tripId: string
): Promise<{ created: number; matches: Match[] }> {
  console.log(`[MATCHING] Finding matches for trip: ${tripId}`)

  // Get the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single<Trip>()

  if (tripError || !trip) {
    console.error(`[MATCHING] Error fetching trip ${tripId}:`, tripError)
    return { created: 0, matches: [] }
  }

  // Find candidate parcels
  const candidateParcels = await findCandidateParcelsForTrip(supabase, tripId)
  console.log(
    `[MATCHING] Found ${candidateParcels.length} candidate parcels for trip ${tripId}`
  )

  const createdMatches: Match[] = []

  // Score each candidate parcel
  for (const parcel of candidateParcels) {
    const score = calculateMatchScore(parcel, trip)

    console.log(
      `[MATCHING] Parcel ${parcel.id} <-> Trip ${tripId}: Score ${score} (threshold: ${MIN_SCORE_THRESHOLD})`
    )

    // Only create match if score meets threshold
    if (isMatchValid(score, MIN_SCORE_THRESHOLD)) {
      const match: Match = {
        parcel_id: parcel.id,
        trip_id: tripId,
        match_score: score,
        status: 'pending',
      }

      // Try to create match record (handle unique constraint if exists)
      const { data: createdMatch, error: matchError } = await (supabase
        .from('parcel_trip_matches') as any)
        .insert(match)
        .select()
        .single()

      if (matchError) {
        // If unique constraint violation, match already exists - skip
        if (matchError.code === '23505') {
          console.log(
            `[MATCHING] Match already exists for parcel ${parcel.id} and trip ${tripId}`
          )
        } else {
          console.error(
            `[MATCHING] Error creating match for parcel ${parcel.id} and trip ${tripId}:`,
            matchError
          )
        }
      } else {
        console.log(
          `[MATCHING] Created match: ${createdMatch.id} (Score: ${score})`
        )
        createdMatches.push(createdMatch as Match)

        // Notify courier of the new match (async, don't block)
        console.log(`[MATCHING] Triggering notification for match ${createdMatch.id}`)
        notifyCourierOfMatch(supabase, createdMatch.id)
          .then(() => {
            console.log(`[MATCHING] ✅ Notification completed for match ${createdMatch.id}`)
          })
          .catch((error) => {
            console.error(
              `[MATCHING] ❌ Error notifying courier of match ${createdMatch.id}:`,
              error
            )
            console.error(`[MATCHING] Notification error stack:`, error.stack)
          })
      }
    }
  }

  console.log(
    `[MATCHING] Created ${createdMatches.length} matches for trip ${tripId}`
  )

  return { created: createdMatches.length, matches: createdMatches }
}

/**
 * Calculate match score for a specific parcel-trip pair
 * Useful for testing or manual scoring
 */
export function calculateMatchScoreForPair(
  parcel: Parcel,
  trip: Trip
): number {
  return calculateMatchScore(parcel, trip)
}
