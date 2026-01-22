/**
 * Debug script to check matching status
 * Run: node scripts/debug-matching.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugMatching() {
  console.log('🔍 Debugging Matching System...\n')

  // Get all trips
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (tripsError) {
    console.error('Error fetching trips:', tripsError)
    return
  }

  console.log(`📦 Found ${trips.length} recent trips:`)
  trips.forEach(trip => {
    console.log(`  - Trip ${trip.id}: ${trip.origin_address} → ${trip.destination_address}`)
    console.log(`    Status: ${trip.status}, Coordinates: ${trip.origin_latitude ? '✅' : '❌'}`)
  })

  // Get all parcels
  const { data: parcels, error: parcelsError } = await supabase
    .from('parcels')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (parcelsError) {
    console.error('Error fetching parcels:', parcelsError)
    return
  }

  console.log(`\n📦 Found ${parcels.length} recent parcels:`)
  parcels.forEach(parcel => {
    console.log(`  - Parcel ${parcel.id}: ${parcel.pickup_address} → ${parcel.delivery_address}`)
    console.log(`    Status: ${parcel.status}, Coordinates: ${parcel.pickup_latitude ? '✅' : '❌'}`)
  })

  // Get all matches
  const { data: matches, error: matchesError } = await supabase
    .from('parcel_trip_matches')
    .select(`
      *,
      parcel:parcels!parcel_trip_matches_parcel_id_fkey(*),
      trip:trips!parcel_trip_matches_trip_id_fkey(*)
    `)
    .order('matched_at', { ascending: false })
    .limit(10)

  if (matchesError) {
    console.error('Error fetching matches:', matchesError)
    return
  }

  console.log(`\n🔗 Found ${matches.length} matches:`)
  matches.forEach(match => {
    console.log(`  - Match ${match.id}: Score ${match.match_score}, Status: ${match.status}`)
    if (match.parcel) {
      console.log(`    Parcel: ${match.parcel.pickup_address} → ${match.parcel.delivery_address}`)
    }
    if (match.trip) {
      console.log(`    Trip: ${match.trip.origin_address} → ${match.trip.destination_address}`)
    }
  })

  // Check for potential matches that weren't created
  console.log('\n🔍 Checking for potential matches...')
  for (const trip of trips) {
    if (trip.status !== 'scheduled' && trip.status !== 'in_progress') continue
    
    for (const parcel of parcels) {
      if (parcel.status !== 'pending') continue
      
      // Check if match already exists
      const { data: existingMatch } = await supabase
        .from('parcel_trip_matches')
        .select('id')
        .eq('parcel_id', parcel.id)
        .eq('trip_id', trip.id)
        .single()

      if (!existingMatch) {
        // Potential match that wasn't created
        console.log(`  ⚠️  Potential match not created:`)
        console.log(`     Parcel: ${parcel.pickup_address} → ${parcel.delivery_address}`)
        console.log(`     Trip: ${trip.origin_address} → ${trip.destination_address}`)
        console.log(`     Parcel coords: ${parcel.pickup_latitude ? '✅' : '❌'}, Trip coords: ${trip.origin_latitude ? '✅' : '❌'}`)
      }
    }
  }

  console.log('\n✅ Debug complete!')
}

debugMatching().catch(console.error)
