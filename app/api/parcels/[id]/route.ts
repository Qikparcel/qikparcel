import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type ParcelUpdate = Database['public']['Tables']['parcels']['Update']

/**
 * GET /api/parcels/[id]
 * Get a specific parcel by ID
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

    const parcelId = params.id

    // Get parcel
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select('*')
      .eq('id', parcelId)
      .single<Parcel>()

    if (parcelError || !parcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    // Only sender can view their own parcel
    if (profile?.role === 'sender' && parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view this parcel' },
        { status: 403 }
      )
    }

    // Get status history
    const { data: statusHistory, error: historyError } = await supabase
      .from('parcel_status_history')
      .select('*')
      .eq('parcel_id', parcelId)
      .order('created_at', { ascending: true })

    if (historyError) {
      console.error('Error fetching status history:', historyError)
    }

    return NextResponse.json({
      success: true,
      parcel,
      statusHistory: statusHistory || [],
    })
  } catch (error: any) {
    console.error('Error in GET /api/parcels/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/parcels/[id]
 * Update a parcel
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

    const parcelId = params.id

    // Get existing parcel to verify ownership
    const { data: existingParcel, error: parcelError } = await supabase
      .from('parcels')
      .select('sender_id, status')
      .eq('id', parcelId)
      .single<Pick<Parcel, 'sender_id' | 'status'>>()

    if (parcelError || !existingParcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    // Only sender can update their own parcel
    if (existingParcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this parcel' },
        { status: 403 }
      )
    }

    // Don't allow editing if parcel is already picked up or delivered
    if (existingParcel.status === 'picked_up' || existingParcel.status === 'delivered' || existingParcel.status === 'in_transit') {
      return NextResponse.json(
        { error: 'Cannot edit parcel that has been picked up or is in transit' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      description,
      weight_kg,
      dimensions,
      estimated_value,
      estimated_value_currency,
    } = body

    // Validate required fields
    if (!pickup_address || !delivery_address) {
      return NextResponse.json(
        { error: 'Pickup and delivery addresses are required' },
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

    // Validate that pickup and delivery addresses are different
    if (areAddressesSame(pickup_address, delivery_address)) {
      return NextResponse.json(
        { error: 'Pickup and delivery addresses cannot be the same' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: ParcelUpdate & { estimated_value_currency?: string | null } = {
      pickup_address,
      pickup_latitude: pickup_latitude || null,
      pickup_longitude: pickup_longitude || null,
      delivery_address,
      delivery_latitude: delivery_latitude || null,
      delivery_longitude: delivery_longitude || null,
      description: description || null,
      weight_kg: weight_kg || null,
      dimensions: dimensions || null,
      estimated_value: estimated_value || null,
      estimated_value_currency: estimated_value_currency || null,
      updated_at: new Date().toISOString(),
    }

    // Update parcel
    const { data: updatedParcel, error: updateError } = await supabase
      .from('parcels')
      // @ts-expect-error - Supabase update method type inference issue
      .update(updateData)
      .eq('id', parcelId)
      .select()
      .single<Parcel>()

    if (updateError) {
      console.error('Error updating parcel:', updateError)
      return NextResponse.json(
        { error: 'Failed to update parcel', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
    })
  } catch (error: any) {
    console.error('Error in PUT /api/parcels/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


