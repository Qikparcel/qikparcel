import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Trip = Database['public']['Tables']['trips']['Row']
type TripInsert = Database['public']['Tables']['trips']['Insert']

/**
 * Normalize address string for comparison
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s,]/g, '') // Remove special characters except commas
}

/**
 * Check if two addresses are the same (normalized comparison)
 */
function areAddressesSame(address1: string, address2: string): boolean {
  return normalizeAddress(address1) === normalizeAddress(address2)
}

/**
 * POST /api/trips
 * Create a new trip route
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to verify role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (profile.role !== 'courier') {
      return NextResponse.json(
        { error: 'Only couriers can create trips' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      origin_address,
      origin_latitude,
      origin_longitude,
      destination_address,
      destination_latitude,
      destination_longitude,
      departure_time,
      estimated_arrival,
      available_capacity,
    } = body

    // Validate required fields
    if (!origin_address || !destination_address) {
      return NextResponse.json(
        { error: 'Origin and destination addresses are required' },
        { status: 400 }
      )
    }

    // Validate that origin and destination addresses are different
    if (areAddressesSame(origin_address, destination_address)) {
      return NextResponse.json(
        { error: 'Origin and destination addresses cannot be the same' },
        { status: 400 }
      )
    }

    // Create trip
    const tripData: TripInsert = {
      courier_id: session.user.id,
      origin_address,
      origin_latitude: origin_latitude || null,
      origin_longitude: origin_longitude || null,
      destination_address,
      destination_latitude: destination_latitude || null,
      destination_longitude: destination_longitude || null,
      departure_time: departure_time || null,
      estimated_arrival: estimated_arrival || null,
      available_capacity: available_capacity || null,
      status: 'scheduled',
    }

    const { data: trip, error: insertError } = await supabase
      .from('trips')
      .insert(tripData as any)
      .select()
      .single<Trip>()

    if (insertError) {
      console.error('Error creating trip:', insertError)
      return NextResponse.json(
        { error: 'Failed to create trip', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      trip,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/trips:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/trips
 * Get trips for the authenticated user (courier)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to verify role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    if (profile.role !== 'courier') {
      return NextResponse.json(
        { error: 'Only couriers can view their trips' },
        { status: 403 }
      )
    }

    // Get trips for this courier
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .eq('courier_id', session.user.id)
      .order('created_at', { ascending: false })

    if (tripsError) {
      console.error('Error fetching trips:', tripsError)
      return NextResponse.json(
        { error: 'Failed to fetch trips', details: tripsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      trips: trips || [],
    })
  } catch (error: any) {
    console.error('Error in GET /api/trips:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


