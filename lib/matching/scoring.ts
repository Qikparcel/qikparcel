/**
 * Matching score calculation algorithm
 * Combines multiple factors to determine how well a parcel matches a trip
 */

import {
  calculateDistance,
  calculateRouteAlignmentScore,
  calculateProximityScore,
} from './distance'
import { Database } from '@/types/database'

type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

interface MatchingConfig {
  routeAlignmentWeight: number
  proximityWeight: number
  timeCompatibilityWeight: number
  capacityWeight: number
  maxPickupDistanceKm: number
  maxDeliveryDistanceKm: number
  maxProximityDistanceKm: number
}

const DEFAULT_CONFIG: MatchingConfig = {
  routeAlignmentWeight: 0.4,
  proximityWeight: 0.3,
  timeCompatibilityWeight: 0.2,
  capacityWeight: 0.1,
  maxPickupDistanceKm: 30, // Increased: 20km from trip origin (was 10km)
  maxDeliveryDistanceKm: 30, // Increased: 20km from trip destination (was 10km)
  maxProximityDistanceKm: 50, // 50km for general proximity scoring
}

/**
 * Calculate time compatibility score (0-100)
 * Checks if parcel preferred pickup time fits within trip departure window
 */
function calculateTimeCompatibilityScore(
  parcel: Parcel,
  trip: Trip
): number {
  // If parcel has preferred pickup time, use it for scoring
  const parcelData = parcel as Parcel & { preferred_pickup_time?: string | null }
  if (parcelData.preferred_pickup_time) {
    const preferredPickup = new Date(parcelData.preferred_pickup_time)
    const now = new Date()

    // If preferred pickup time is in the past, score is 0
    if (preferredPickup < now) {
      return 0
    }

    // If trip has departure time, check compatibility
    if (trip.departure_time) {
      const tripDeparture = new Date(trip.departure_time)
      
      // If trip has already departed, score is 0
      if (tripDeparture < now) {
        return 0
      }

      // Calculate time difference between preferred pickup and trip departure
      const hoursDiff = Math.abs(preferredPickup.getTime() - tripDeparture.getTime()) / (1000 * 60 * 60)
      
      // Perfect match: preferred pickup is close to trip departure
      if (hoursDiff <= 1) {
        return 100 // Within 1 hour - perfect match
      } else if (hoursDiff <= 3) {
        return 80  // Within 3 hours - good match
      } else if (hoursDiff <= 6) {
        return 60  // Within 6 hours - acceptable
      } else if (hoursDiff <= 12) {
        return 40  // Within 12 hours - poor match
      } else {
        return 20  // More than 12 hours - very poor match
      }
    } else {
      // Trip is flexible, check if preferred pickup is reasonable (not too far in future)
      const hoursUntilPickup = (preferredPickup.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      if (hoursUntilPickup < 0) {
        return 0 // Past time
      } else if (hoursUntilPickup <= 24) {
        return 90 // Within 24 hours - good
      } else if (hoursUntilPickup <= 72) {
        return 70 // Within 3 days - acceptable
      } else {
        return 50 // More than 3 days - moderate
      }
    }
  }

  // If parcel doesn't have preferred pickup time, check trip departure
  if (trip.departure_time) {
    const tripDeparture = new Date(trip.departure_time)
    const now = new Date()

    // If trip has already departed, score is 0
    if (tripDeparture < now) {
      return 0
    }

    // If trip departure is in the future, parcel can be ready
    // Give score based on how far in the future (more time = better)
    const hoursUntilDeparture = (tripDeparture.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilDeparture < 1) {
      return 30 // Very short notice
    } else if (hoursUntilDeparture < 24) {
      return 70 // Same day
    } else {
      return 90 // Advance notice
    }
  }

  // Both are flexible - give moderate score
  return 70
}

/**
 * Map parcel dimensions/weight to size category
 */
function getParcelSizeCategory(parcel: Parcel): 'small' | 'medium' | 'large' | null {
  if (!parcel.dimensions && !parcel.weight_kg) {
    return null // Unknown size
  }

  // Simple heuristic based on weight and dimensions
  // This can be refined based on actual requirements
  const weight = parcel.weight_kg || 0

  if (weight <= 2) {
    return 'small'
  } else if (weight <= 10) {
    return 'medium'
  } else {
    return 'large'
  }
}

/**
 * Calculate capacity matching score (0-100)
 * Checks if parcel size fits trip available capacity
 */
function calculateCapacityScore(parcel: Parcel, trip: Trip): number {
  if (!trip.available_capacity) {
    // If trip doesn't specify capacity, give moderate score (assumes flexible)
    return 70
  }

  const parcelSize = getParcelSizeCategory(parcel)
  if (!parcelSize) {
    // If parcel size is unknown, give moderate score
    return 60
  }

  const tripCapacity = trip.available_capacity.toLowerCase()

  // Exact match = 100
  if (tripCapacity === parcelSize) {
    return 100
  }

  // Check if trip capacity can accommodate parcel
  const capacityHierarchy = {
    small: 1,
    medium: 2,
    large: 3,
  }

  const parcelLevel = capacityHierarchy[parcelSize]
  const tripLevel = capacityHierarchy[tripCapacity as keyof typeof capacityHierarchy] || 0

  // If trip capacity is larger than parcel, it can accommodate (partial score)
  if (tripLevel >= parcelLevel) {
    // Score based on how well it fits
    if (tripLevel === parcelLevel + 1) {
      return 80 // One size larger, good fit
    } else if (tripLevel > parcelLevel + 1) {
      return 60 // Much larger capacity, less optimal but acceptable
    }
  }

  // If trip capacity is smaller than parcel, it cannot accommodate
  return 0
}

/**
 * Calculate geographic proximity score (0-100)
 * Combines proximity of pickup to origin and delivery to destination
 */
function calculateGeographicProximityScore(
  parcel: Parcel,
  trip: Trip,
  config: MatchingConfig
): number {
  // Both need coordinates to calculate proximity
  if (
    !parcel.pickup_latitude ||
    !parcel.pickup_longitude ||
    !parcel.delivery_latitude ||
    !parcel.delivery_longitude ||
    !trip.origin_latitude ||
    !trip.origin_longitude ||
    !trip.destination_latitude ||
    !trip.destination_longitude
  ) {
    // If coordinates are missing, try to match based on address similarity
    // Check if cities match (common case: both going to same city)
    const normalizeCity = (address: string): string => {
      // Extract city from address (usually second-to-last part)
      const parts = address.split(',').map(p => p.trim().toLowerCase())
      if (parts.length >= 2) {
        return parts[parts.length - 2] // City is usually second-to-last
      }
      return address.toLowerCase()
    }
    
    const pickupCity = normalizeCity(parcel.pickup_address)
    const deliveryCity = normalizeCity(parcel.delivery_address)
    const originCity = normalizeCity(trip.origin_address)
    const destCity = normalizeCity(trip.destination_address)
    
    // If cities match, give higher score
    if (pickupCity === originCity && deliveryCity === destCity) {
      return 70 // Improved: Good match based on city (was 60)
    } else if (pickupCity === originCity || deliveryCity === destCity) {
      return 60 // Improved: Partial match (was 50)
    }
    
    // Otherwise, give a moderate score
    return 50 // Improved: Moderate score (was 45)
  }

  // Calculate distances
  const pickupDistance = calculateDistance(
    parcel.pickup_latitude,
    parcel.pickup_longitude,
    trip.origin_latitude,
    trip.origin_longitude
  )

  const deliveryDistance = calculateDistance(
    parcel.delivery_latitude,
    parcel.delivery_longitude,
    trip.destination_latitude,
    trip.destination_longitude
  )

  // Calculate proximity scores
  const pickupProximity = calculateProximityScore(
    pickupDistance,
    config.maxProximityDistanceKm
  )

  const deliveryProximity = calculateProximityScore(
    deliveryDistance,
    config.maxProximityDistanceKm
  )

  // Average of pickup and delivery proximity
  return (pickupProximity + deliveryProximity) / 2
}

/**
 * Calculate route alignment score (0-100)
 * Measures how well parcel route aligns with trip route
 */
function calculateRouteAlignment(
  parcel: Parcel,
  trip: Trip,
  config: MatchingConfig
): number {
  // Both need coordinates to calculate route alignment
  if (
    !parcel.pickup_latitude ||
    !parcel.pickup_longitude ||
    !parcel.delivery_latitude ||
    !parcel.delivery_longitude ||
    !trip.origin_latitude ||
    !trip.origin_longitude ||
    !trip.destination_latitude ||
    !trip.destination_longitude
  ) {
    // If coordinates are missing, try to match based on addresses
    // Check if origin/destination cities match
    const normalizeCity = (address: string): string => {
      const parts = address.split(',').map(p => p.trim().toLowerCase())
      if (parts.length >= 2) {
        return parts[parts.length - 2]
      }
      return address.toLowerCase()
    }
    
    const pickupCity = normalizeCity(parcel.pickup_address)
    const deliveryCity = normalizeCity(parcel.delivery_address)
    const originCity = normalizeCity(trip.origin_address)
    const destCity = normalizeCity(trip.destination_address)
    
    // Perfect route alignment: same origin and destination cities
    if (pickupCity === originCity && deliveryCity === destCity) {
      return 75 // Improved: Good route alignment based on cities (was 70)
    } else if (pickupCity === originCity || deliveryCity === destCity) {
      return 60 // Improved: Partial alignment (was 55)
    }
    
    return 55 // Improved: Moderate score for address-based matching (was 50)
  }

  const score = calculateRouteAlignmentScore(
    parcel.pickup_latitude,
    parcel.pickup_longitude,
    parcel.delivery_latitude,
    parcel.delivery_longitude,
    trip.origin_latitude,
    trip.origin_longitude,
    trip.destination_latitude,
    trip.destination_longitude,
    config.maxPickupDistanceKm,
    config.maxDeliveryDistanceKm
  )

  // Log distances for debugging
  const pickupDist = calculateDistance(
    parcel.pickup_latitude!,
    parcel.pickup_longitude!,
    trip.origin_latitude!,
    trip.origin_longitude!
  )
  const deliveryDist = calculateDistance(
    parcel.delivery_latitude!,
    parcel.delivery_longitude!,
    trip.destination_latitude!,
    trip.destination_longitude!
  )
  console.log(`[ROUTE ALIGNMENT] Parcel ${parcel.id} <-> Trip ${trip.id}:`, {
    pickupDistance: `${pickupDist.toFixed(2)}km`,
    deliveryDistance: `${deliveryDist.toFixed(2)}km`,
    score: score.toFixed(2)
  })

  return score
}

/**
 * Calculate overall match score for a parcel-trip pair
 * @param parcel The parcel to match
 * @param trip The trip to match against
 * @param config Optional configuration (uses defaults if not provided)
 * @returns Match score from 0 to 100
 */
export function calculateMatchScore(
  parcel: Parcel,
  trip: Trip,
  config: Partial<MatchingConfig> = {}
): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Calculate individual component scores
  const routeAlignment = calculateRouteAlignment(parcel, trip, finalConfig)
  const proximity = calculateGeographicProximityScore(parcel, trip, finalConfig)
  const timeCompatibility = calculateTimeCompatibilityScore(parcel, trip)
  const capacity = calculateCapacityScore(parcel, trip)

  // Weighted combination
  const totalScore =
    routeAlignment * finalConfig.routeAlignmentWeight +
    proximity * finalConfig.proximityWeight +
    timeCompatibility * finalConfig.timeCompatibilityWeight +
    capacity * finalConfig.capacityWeight

  // Log detailed score breakdown for debugging
  console.log(`[SCORING] Score breakdown for Parcel ${parcel.id} <-> Trip ${trip.id}:`, {
    routeAlignment: `${routeAlignment.toFixed(2)} (weight: ${finalConfig.routeAlignmentWeight})`,
    proximity: `${proximity.toFixed(2)} (weight: ${finalConfig.proximityWeight})`,
    timeCompatibility: `${timeCompatibility.toFixed(2)} (weight: ${finalConfig.timeCompatibilityWeight})`,
    capacity: `${capacity.toFixed(2)} (weight: ${finalConfig.capacityWeight})`,
    totalScore: totalScore.toFixed(2),
    hasCoordinates: !!(parcel.pickup_latitude && parcel.pickup_longitude && trip.origin_latitude && trip.origin_longitude)
  })

  // Round to 2 decimal places
  return Math.round(totalScore * 100) / 100
}

/**
 * Check if a match score meets the minimum threshold
 */
export function isMatchValid(score: number, minThreshold: number = 60): boolean {
  return score >= minThreshold
}
