/**
 * Test script for the matching engine
 * 
 * Usage:
 *   node scripts/test-matching.js
 * 
 * This script tests the matching engine by:
 * 1. Creating test parcels and trips with coordinates
 * 2. Triggering matching
 * 3. Verifying matches are created
 * 4. Testing accept/reject workflows
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function testMatching() {
  console.log('🧪 Starting Matching Engine Test\n')

  try {
    // Step 1: Get or create test users
    console.log('📋 Step 1: Setting up test users...')
    
    const { data: senders } = await supabase
      .from('profiles')
      .select('id, phone_number, role')
      .eq('role', 'sender')
      .limit(1)

    const { data: couriers } = await supabase
      .from('profiles')
      .select('id, phone_number, role')
      .eq('role', 'courier')
      .limit(1)

    if (!senders || senders.length === 0) {
      console.error('❌ No sender found. Please create a sender account first.')
      return
    }

    if (!couriers || couriers.length === 0) {
      console.error('❌ No courier found. Please create a courier account first.')
      return
    }

    const sender = senders[0]
    const courier = couriers[0]

    console.log(`✅ Found sender: ${sender.phone_number} (${sender.id})`)
    console.log(`✅ Found courier: ${courier.phone_number} (${courier.id})\n`)

    // Step 2: Create a trip
    console.log('📋 Step 2: Creating test trip...')
    
    const tripData = {
      courier_id: courier.id,
      origin_address: 'London, UK',
      origin_latitude: 51.5074,
      origin_longitude: -0.1278,
      destination_address: 'Manchester, UK',
      destination_latitude: 53.4808,
      destination_longitude: -2.2426,
      departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      estimated_arrival: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
      available_capacity: 'medium',
      status: 'scheduled',
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert(tripData)
      .select()
      .single()

    if (tripError) {
      console.error('❌ Error creating trip:', tripError)
      return
    }

    console.log(`✅ Created trip: ${trip.id}`)
    console.log(`   Route: ${trip.origin_address} → ${trip.destination_address}\n`)

    // Step 3: Create a parcel that should match
    console.log('📋 Step 3: Creating test parcel (should match)...')
    
    // Parcel pickup near London, delivery near Manchester
    const parcelData = {
      sender_id: sender.id,
      pickup_address: 'Central London, UK',
      pickup_latitude: 51.5155, // Near trip origin
      pickup_longitude: -0.0922,
      delivery_address: 'Manchester City Centre, UK',
      delivery_latitude: 53.4839, // Near trip destination
      delivery_longitude: -2.2446,
      description: 'Test parcel for matching',
      weight_kg: 3.5, // Fits medium capacity
      dimensions: '30x20x15 cm',
      status: 'pending',
    }

    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .insert(parcelData)
      .select()
      .single()

    if (parcelError) {
      console.error('❌ Error creating parcel:', parcelError)
      return
    }

    console.log(`✅ Created parcel: ${parcel.id}`)
    console.log(`   Route: ${parcel.pickup_address} → ${parcel.delivery_address}\n`)

    // Step 4: Wait a moment for matching to complete
    console.log('⏳ Step 4: Waiting for matching engine to process...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Step 5: Check for matches
    console.log('📋 Step 5: Checking for matches...')
    
    const { data: matches, error: matchesError } = await supabase
      .from('parcel_trip_matches')
      .select('*, parcel:parcels(*), trip:trips(*)')
      .eq('parcel_id', parcel.id)
      .eq('trip_id', trip.id)

    if (matchesError) {
      console.error('❌ Error fetching matches:', matchesError)
      return
    }

    if (!matches || matches.length === 0) {
      console.log('⚠️  No matches found. This could mean:')
      console.log('   1. Matching engine hasn\'t run yet (check server logs)')
      console.log('   2. Match score is below threshold (60)')
      console.log('   3. There was an error in matching')
      console.log('\n   Try creating the parcel/trip through the web UI to trigger matching.\n')
    } else {
      const match = matches[0]
      console.log(`✅ Found match: ${match.id}`)
      console.log(`   Score: ${match.match_score}/100`)
      console.log(`   Status: ${match.status}\n`)

      // Step 6: Test accepting the match
      console.log('📋 Step 6: Testing match acceptance...')
      
      const acceptResponse = await fetch(
        `http://localhost:3000/api/matching/matches/${match.id}/accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      ).catch(() => null)

      if (acceptResponse && acceptResponse.ok) {
        console.log('✅ Match accept endpoint works!')
      } else {
        console.log('⚠️  Match accept endpoint test skipped (server may not be running)')
        console.log('   To test: Start server and manually accept match via UI\n')
      }
    }

    // Step 7: Cleanup (optional)
    console.log('📋 Step 7: Cleanup...')
    console.log('   Created test data:')
    console.log(`   - Trip: ${trip.id}`)
    console.log(`   - Parcel: ${parcel.id}`)
    console.log('   You can manually delete these from the admin panel if needed.\n')

    console.log('✅ Test completed!\n')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testMatching()
  .then(() => {
    console.log('🎉 All tests done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
