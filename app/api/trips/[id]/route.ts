import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Trip = Database['public']['Tables']['trips']['Row']
type TripUpdate = Database['public']['Tables']['trips']['Update']

/**
 * GET /api/trips/[id]
 * Get a specific trip by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const tripId = params.id

    // Get trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single<Trip>()

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    // Only courier can view their own trip
    if (profile?.role === 'courier' && trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view this trip' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      trip,
    })
  } catch (error: any) {
    console.error('Error in GET /api/trips/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/trips/[id]
 * Update a trip
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const tripId = params.id

    // Get existing trip to verify ownership
    const { data: existingTrip, error: tripError } = await supabase
      .from('trips')
      .select('courier_id, status')
      .eq('id', tripId)
      .single<Pick<Trip, 'courier_id' | 'status'>>()

    if (tripError || !existingTrip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      )
    }

    // Only courier can update their own trip
    if (existingTrip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this trip' },
        { status: 403 }
      )
    }

    // Only allow editing if trip is in scheduled state (initial/pending state)
    if (existingTrip.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Can only edit trips in scheduled state' },
        { status: 400 }
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

    // Validate that both dates are provided (mandatory fields)
    if (!departure_time || !departure_time.trim()) {
      return NextResponse.json(
        { error: 'Departure time is required' },
        { status: 400 }
      )
    }

    if (!estimated_arrival || !estimated_arrival.trim()) {
      return NextResponse.json(
        { error: 'Estimated arrival is required' },
        { status: 400 }
      )
    }

    // Normalize address for comparison
    const normalizeAddress = (address: string): string => {
      return address
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s,]/g, '')
    }

    const areAddressesSame = (address1: string, address2: string): boolean => {
      return normalizeAddress(address1) === normalizeAddress(address2)
    }

    // Validate that origin and destination addresses are different
    if (areAddressesSame(origin_address, destination_address)) {
      return NextResponse.json(
        { error: 'Origin and destination addresses cannot be the same' },
        { status: 400 }
      )
    }

    // Validate dates are not in the past
    const now = new Date()
    now.setSeconds(0, 0)

    const departureDate = new Date(departure_time)
    if (isNaN(departureDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid departure time format' },
        { status: 400 }
      )
    }
    if (departureDate.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: 'Departure time cannot be in the past' },
        { status: 400 }
      )
    }

    const arrivalDate = new Date(estimated_arrival)
    if (isNaN(arrivalDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid estimated arrival time format' },
        { status: 400 }
      )
    }
    if (arrivalDate.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: 'Estimated arrival cannot be in the past' },
        { status: 400 }
      )
    }

    // Ensure arrival is after departure
    if (arrivalDate.getTime() <= departureDate.getTime()) {
      return NextResponse.json(
        { error: 'Estimated arrival must be after departure time' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: TripUpdate = {
      origin_address,
      origin_latitude: origin_latitude || null,
      origin_longitude: origin_longitude || null,
      destination_address,
      destination_latitude: destination_latitude || null,
      destination_longitude: destination_longitude || null,
      departure_time,
      estimated_arrival,
      available_capacity: available_capacity || null,
      updated_at: new Date().toISOString(),
    }

    // Update trip
    const { data: updatedTrip, error: updateError } = await supabase
      .from('trips')
      // @ts-expect-error - Supabase update method type inference issue
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single<Trip>()

    if (updateError) {
      console.error('Error updating trip:', updateError)
      return NextResponse.json(
        { error: 'Failed to update trip', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      trip: updatedTrip,
    })
  } catch (error: any) {
    console.error('Error in PUT /api/trips/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


