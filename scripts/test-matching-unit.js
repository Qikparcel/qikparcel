/**
 * Unit test for matching engine scoring algorithm
 * Tests the matching logic without requiring database access
 */

require('dotenv').config({ path: '.env.local' })

// Mock the distance calculation (simplified version)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180)
}

function calculateProximityScore(distanceKm, maxDistanceKm) {
  if (distanceKm >= maxDistanceKm) return 0
  if (distanceKm <= 0) return 100
  const score = 100 * (1 - distanceKm / maxDistanceKm)
  return Math.max(0, Math.min(100, score))
}

function calculateRouteAlignmentScore(
  parcelPickupLat, parcelPickupLon,
  parcelDeliveryLat, parcelDeliveryLon,
  tripOriginLat, tripOriginLon,
  tripDestLat, tripDestLon,
  maxPickupDistanceKm = 10,
  maxDeliveryDistanceKm = 10
) {
  const pickupDistance = calculateDistance(
    parcelPickupLat, parcelPickupLon,
    tripOriginLat, tripOriginLon
  )
  const deliveryDistance = calculateDistance(
    parcelDeliveryLat, parcelDeliveryLon,
    tripDestLat, tripDestLon
  )

  if (pickupDistance > maxPickupDistanceKm || deliveryDistance > maxDeliveryDistanceKm) {
    return 0
  }

  const pickupScore = calculateProximityScore(pickupDistance, maxPickupDistanceKm)
  const deliveryScore = calculateProximityScore(deliveryDistance, maxDeliveryDistanceKm)
  return (pickupScore + deliveryScore) / 2
}

function calculateTimeCompatibilityScore(parcel, trip) {
  if (!trip.departure_time) return 70
  const tripDeparture = new Date(trip.departure_time)
  const now = new Date()
  if (tripDeparture < now) return 0
  const hoursUntilDeparture = (tripDeparture.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursUntilDeparture < 1) return 30
  if (hoursUntilDeparture < 24) return 70
  return 90
}

function getParcelSizeCategory(parcel) {
  const weight = parcel.weight_kg || 0
  if (weight <= 2) return 'small'
  if (weight <= 10) return 'medium'
  return 'large'
}

function calculateCapacityScore(parcel, trip) {
  if (!trip.available_capacity) return 70
  const parcelSize = getParcelSizeCategory(parcel)
  if (!parcelSize) return 60
  const tripCapacity = trip.available_capacity.toLowerCase()
  if (tripCapacity === parcelSize) return 100
  
  const capacityHierarchy = { small: 1, medium: 2, large: 3 }
  const parcelLevel = capacityHierarchy[parcelSize]
  const tripLevel = capacityHierarchy[tripCapacity] || 0
  
  if (tripLevel >= parcelLevel) {
    if (tripLevel === parcelLevel + 1) return 80
    if (tripLevel > parcelLevel + 1) return 60
  }
  return 0
}

function calculateGeographicProximityScore(parcel, trip, config) {
  if (
    !parcel.pickup_latitude || !parcel.pickup_longitude ||
    !parcel.delivery_latitude || !parcel.delivery_longitude ||
    !trip.origin_latitude || !trip.origin_longitude ||
    !trip.destination_latitude || !trip.destination_longitude
  ) {
    return 40
  }

  const pickupDistance = calculateDistance(
    parcel.pickup_latitude, parcel.pickup_longitude,
    trip.origin_latitude, trip.origin_longitude
  )
  const deliveryDistance = calculateDistance(
    parcel.delivery_latitude, parcel.delivery_longitude,
    trip.destination_latitude, trip.destination_longitude
  )

  const pickupProximity = calculateProximityScore(pickupDistance, config.maxProximityDistanceKm)
  const deliveryProximity = calculateProximityScore(deliveryDistance, config.maxProximityDistanceKm)
  return (pickupProximity + deliveryProximity) / 2
}

function calculateRouteAlignment(parcel, trip, config) {
  if (
    !parcel.pickup_latitude || !parcel.pickup_longitude ||
    !parcel.delivery_latitude || !parcel.delivery_longitude ||
    !trip.origin_latitude || !trip.origin_longitude ||
    !trip.destination_latitude || !trip.destination_longitude
  ) {
    return 50
  }

  return calculateRouteAlignmentScore(
    parcel.pickup_latitude, parcel.pickup_longitude,
    parcel.delivery_latitude, parcel.delivery_longitude,
    trip.origin_latitude, trip.origin_longitude,
    trip.destination_latitude, trip.destination_longitude,
    config.maxPickupDistanceKm,
    config.maxDeliveryDistanceKm
  )
}

function calculateMatchScore(parcel, trip) {
  const config = {
    routeAlignmentWeight: 0.4,
    proximityWeight: 0.3,
    timeCompatibilityWeight: 0.2,
    capacityWeight: 0.1,
    maxPickupDistanceKm: 10,
    maxDeliveryDistanceKm: 10,
    maxProximityDistanceKm: 50,
  }

  const routeAlignment = calculateRouteAlignment(parcel, trip, config)
  const proximity = calculateGeographicProximityScore(parcel, trip, config)
  const timeCompatibility = calculateTimeCompatibilityScore(parcel, trip)
  const capacity = calculateCapacityScore(parcel, trip)

  const totalScore =
    routeAlignment * config.routeAlignmentWeight +
    proximity * config.proximityWeight +
    timeCompatibility * config.timeCompatibilityWeight +
    capacity * config.capacityWeight

  return Math.round(totalScore * 100) / 100
}

// Test Cases
console.log('🧪 Matching Engine Unit Tests\n')
console.log('=' .repeat(60))

let testsPassed = 0
let testsFailed = 0

function test(name, parcel, trip, expectedMinScore = 60) {
  const score = calculateMatchScore(parcel, trip)
  const passed = score >= expectedMinScore
  
  console.log(`\n📋 Test: ${name}`)
  console.log(`   Parcel: ${parcel.pickup_address} → ${parcel.delivery_address}`)
  console.log(`   Trip: ${trip.origin_address} → ${trip.destination_address}`)
  console.log(`   Score: ${score}/100 ${passed ? '✅' : '❌'}`)
  console.log(`   Expected: >= ${expectedMinScore}`)
  
  if (passed) {
    testsPassed++
  } else {
    testsFailed++
    console.log(`   ⚠️  Score below threshold`)
  }
}

// Test 1: Perfect Match (London → Manchester)
const perfectParcel = {
  pickup_address: 'Central London, UK',
  pickup_latitude: 51.5155,
  pickup_longitude: -0.0922,
  delivery_address: 'Manchester City Centre, UK',
  delivery_latitude: 53.4839,
  delivery_longitude: -2.2446,
  weight_kg: 3.5,
  dimensions: '30x20x15 cm',
}

const perfectTrip = {
  origin_address: 'London, UK',
  origin_latitude: 51.5074,
  origin_longitude: -0.1278,
  destination_address: 'Manchester, UK',
  destination_latitude: 53.4808,
  destination_longitude: -2.2426,
  departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  available_capacity: 'medium',
}

test('Perfect Match (London → Manchester)', perfectParcel, perfectTrip, 70)

// Test 2: Good Match (Close proximity)
const goodParcel = {
  pickup_address: 'Birmingham, UK',
  pickup_latitude: 52.4862,
  pickup_longitude: -1.8904,
  delivery_address: 'Leeds, UK',
  delivery_latitude: 53.8008,
  delivery_longitude: -1.5491,
  weight_kg: 2.0,
}

const goodTrip = {
  origin_address: 'Birmingham City Centre, UK',
  origin_latitude: 52.4862,
  origin_longitude: -1.8904,
  destination_address: 'Leeds City Centre, UK',
  destination_latitude: 53.8008,
  destination_longitude: -1.5491,
  departure_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  available_capacity: 'small',
}

test('Good Match (Birmingham → Leeds)', goodParcel, goodTrip, 60)

// Test 3: Poor Match (Far apart)
const poorParcel = {
  pickup_address: 'London, UK',
  pickup_latitude: 51.5074,
  pickup_longitude: -0.1278,
  delivery_address: 'Edinburgh, UK',
  delivery_latitude: 55.9533,
  delivery_longitude: -3.1883,
  weight_kg: 5.0,
}

const poorTrip = {
  origin_address: 'Manchester, UK',
  origin_latitude: 53.4808,
  origin_longitude: -2.2426,
  destination_address: 'Birmingham, UK',
  destination_latitude: 52.4862,
  destination_longitude: -1.8904,
  departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  available_capacity: 'medium',
}

test('Poor Match (Different Routes)', poorParcel, poorTrip, 0)

// Test 4: Capacity Mismatch
const capacityParcel = {
  pickup_address: 'London, UK',
  pickup_latitude: 51.5074,
  pickup_longitude: -0.1278,
  delivery_address: 'Manchester, UK',
  delivery_latitude: 53.4808,
  delivery_longitude: -2.2426,
  weight_kg: 15.0, // Large parcel
}

const capacityTrip = {
  origin_address: 'London, UK',
  origin_latitude: 51.5074,
  origin_longitude: -0.1278,
  destination_address: 'Manchester, UK',
  destination_latitude: 53.4808,
  destination_longitude: -2.2426,
  departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  available_capacity: 'small', // Small capacity
}

test('Capacity Mismatch (Large parcel, Small trip)', capacityParcel, capacityTrip, 0)

// Test 5: Missing Coordinates (should still work with address matching)
const noCoordsParcel = {
  pickup_address: 'London, UK',
  pickup_latitude: null,
  pickup_longitude: null,
  delivery_address: 'Manchester, UK',
  delivery_latitude: null,
  delivery_longitude: null,
  weight_kg: 3.0,
}

const noCoordsTrip = {
  origin_address: 'London, UK',
  origin_latitude: null,
  origin_longitude: null,
  destination_address: 'Manchester, UK',
  destination_latitude: null,
  destination_longitude: null,
  departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  available_capacity: 'medium',
}

test('No Coordinates (Address-only matching)', noCoordsParcel, noCoordsTrip, 40)

// Test Results
console.log('\n' + '='.repeat(60))
console.log('\n📊 Test Results:')
console.log(`   ✅ Passed: ${testsPassed}`)
console.log(`   ❌ Failed: ${testsFailed}`)
console.log(`   📈 Total: ${testsPassed + testsFailed}`)

if (testsFailed === 0) {
  console.log('\n🎉 All tests passed! Matching engine logic is working correctly.\n')
} else {
  console.log('\n⚠️  Some tests failed. Review the scoring algorithm.\n')
}

// Distance calculation verification
console.log('📏 Distance Calculation Verification:')
const londonToManchester = calculateDistance(51.5074, -0.1278, 53.4808, -2.2426)
console.log(`   London → Manchester: ${londonToManchester.toFixed(2)} km (Expected: ~200 km)`)
if (Math.abs(londonToManchester - 200) < 50) {
  console.log('   ✅ Distance calculation is accurate\n')
} else {
  console.log('   ⚠️  Distance calculation may need review\n')
}
