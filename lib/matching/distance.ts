/**
 * Geographic distance calculations and proximity checks
 * Uses Haversine formula for accurate distance calculations on Earth's surface
 */

/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if two points are within a specified distance threshold
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @param thresholdKm Distance threshold in kilometers
 * @returns True if points are within threshold
 */
export function isWithinDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdKm: number
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= thresholdKm;
}

/**
 * Calculate a proximity score (0-100) based on distance
 * Score decreases linearly as distance increases
 * @param distanceKm Distance in kilometers
 * @param maxDistanceKm Maximum distance for scoring (beyond this, score is 0)
 * @returns Score from 0 to 100
 */
export function calculateProximityScore(
  distanceKm: number,
  maxDistanceKm: number
): number {
  if (distanceKm >= maxDistanceKm) {
    return 0;
  }
  if (distanceKm <= 0) {
    return 100;
  }

  // Linear decrease from 100 to 0
  const score = 100 * (1 - distanceKm / maxDistanceKm);
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate route alignment score for a parcel and trip
 * Checks how well the parcel pickup/delivery aligns with trip origin/destination
 * @param parcelPickupLat Parcel pickup latitude
 * @param parcelPickupLon Parcel pickup longitude
 * @param parcelDeliveryLat Parcel delivery latitude
 * @param parcelDeliveryLon Parcel delivery longitude
 * @param tripOriginLat Trip origin latitude
 * @param tripOriginLon Trip origin longitude
 * @param tripDestLat Trip destination latitude
 * @param tripDestLon Trip destination longitude
 * @param maxPickupDistanceKm Maximum acceptable distance from trip origin to parcel pickup
 * @param maxDeliveryDistanceKm Maximum acceptable distance from trip destination to parcel delivery
 * @returns Score from 0 to 100
 */
export function calculateRouteAlignmentScore(
  parcelPickupLat: number,
  parcelPickupLon: number,
  parcelDeliveryLat: number,
  parcelDeliveryLon: number,
  tripOriginLat: number,
  tripOriginLon: number,
  tripDestLat: number,
  tripDestLon: number,
  maxPickupDistanceKm: number = 10,
  maxDeliveryDistanceKm: number = 10
): number {
  // Calculate distances
  const pickupDistance = calculateDistance(
    parcelPickupLat,
    parcelPickupLon,
    tripOriginLat,
    tripOriginLon
  );

  const deliveryDistance = calculateDistance(
    parcelDeliveryLat,
    parcelDeliveryLon,
    tripDestLat,
    tripDestLon
  );

  // If either distance exceeds threshold, return 0
  if (
    pickupDistance > maxPickupDistanceKm ||
    deliveryDistance > maxDeliveryDistanceKm
  ) {
    return 0;
  }

  // Calculate proximity scores for pickup and delivery
  const pickupScore = calculateProximityScore(
    pickupDistance,
    maxPickupDistanceKm
  );
  const deliveryScore = calculateProximityScore(
    deliveryDistance,
    maxDeliveryDistanceKm
  );

  // Average of pickup and delivery alignment (equal weight)
  const alignmentScore = (pickupScore + deliveryScore) / 2;

  return alignmentScore;
}
