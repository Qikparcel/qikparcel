/**
 * Manually trigger matching for a specific parcel
 * Usage: node scripts/test-matching-manual.js <parcel-id>
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

// Import the matching service
async function testMatching() {
  const parcelId = process.argv[2]
  
  if (!parcelId) {
    console.error('Usage: node scripts/test-matching-manual.js <parcel-id>')
    console.log('\nAvailable parcels:')
    const { data: parcels } = await supabase
      .from('parcels')
      .select('id, pickup_address, delivery_address, status')
      .order('created_at', { ascending: false })
      .limit(5)
    
    parcels?.forEach(p => {
      console.log(`  ${p.id} - ${p.pickup_address} → ${p.delivery_address} (${p.status})`)
    })
    process.exit(1)
  }

  console.log(`🔍 Testing matching for parcel: ${parcelId}\n`)

  // Get parcel details
  const { data: parcel, error: parcelError } = await supabase
    .from('parcels')
    .select('*')
    .eq('id', parcelId)
    .single()

  if (parcelError || !parcel) {
    console.error('Error fetching parcel:', parcelError)
    process.exit(1)
  }

  console.log('Parcel details:')
  console.log(`  Pickup: ${parcel.pickup_address}`)
  console.log(`  Delivery: ${parcel.delivery_address}`)
  console.log(`  Coordinates: ${parcel.pickup_latitude ? '✅' : '❌'}`)
  console.log(`  Status: ${parcel.status}\n`)

  // Get available trips
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .in('status', ['scheduled', 'in_progress'])

  if (tripsError) {
    console.error('Error fetching trips:', tripsError)
    process.exit(1)
  }

  console.log(`Found ${trips.length} available trips:\n`)

  // Import matching functions (we'll need to use the compiled version or import directly)
  // For now, let's manually calculate scores
  const { calculateMatchScore } = require('../lib/matching/scoring')
  
  for (const trip of trips) {
    console.log(`Trip: ${trip.origin_address} → ${trip.destination_address}`)
    console.log(`  Coordinates: ${trip.origin_latitude ? '✅' : '❌'}`)
    
    try {
      const score = calculateMatchScore(parcel, trip)
      console.log(`  Score: ${score} (threshold: 60)`)
      
      if (score >= 60) {
        console.log(`  ✅ Would create match!`)
      } else {
        console.log(`  ❌ Score too low`)
      }
    } catch (error) {
      console.error(`  Error calculating score:`, error)
    }
    console.log()
  }

  // Now try to trigger matching
  console.log('\n🚀 Triggering matching service...\n')
  
  try {
    // We need to import the service - let's use dynamic import
    const { findAndCreateMatchesForParcel } = await import('../lib/matching/service.ts')
    const result = await findAndCreateMatchesForParcel(supabase, parcelId)
    
    console.log(`\n✅ Matching completed:`)
    console.log(`   Created: ${result.created} matches`)
    console.log(`   Matches: ${result.matches.length}`)
    
    if (result.matches.length > 0) {
      result.matches.forEach(m => {
        console.log(`   - Match ${m.id}: Score ${m.match_score}`)
      })
    }
  } catch (error) {
    console.error('Error running matching:', error)
    console.error(error.stack)
  }
}

testMatching().catch(console.error)
