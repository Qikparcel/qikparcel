import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type ParcelInsert = Database['public']['Tables']['parcels']['Insert']
type ParcelStatusHistoryInsert = Database['public']['Tables']['parcel_status_history']['Insert']

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
 * POST /api/parcels
 * Create a new parcel request
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

    if (profile.role !== 'sender') {
      return NextResponse.json(
        { error: 'Only senders can create parcels' },
        { status: 403 }
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

    // Validate that pickup and delivery addresses are different
    if (areAddressesSame(pickup_address, delivery_address)) {
      return NextResponse.json(
        { error: 'Pickup and delivery addresses cannot be the same' },
        { status: 400 }
      )
    }

    // Create parcel
    const parcelData: ParcelInsert = {
      sender_id: session.user.id,
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
      status: 'pending',
    } as any

    const { data: parcel, error: insertError } = await supabase
      .from('parcels')
      .insert(parcelData as any)
      .select()
      .single<Parcel>()

    if (insertError) {
      console.error('Error creating parcel:', insertError)
      return NextResponse.json(
        { error: 'Failed to create parcel', details: insertError.message },
        { status: 500 }
      )
    }

    // Create initial status history entry
    const statusHistoryData: ParcelStatusHistoryInsert = {
      parcel_id: parcel.id,
      status: 'pending',
      notes: 'Parcel request created',
    }
    
    await supabase
      .from('parcel_status_history')
      .insert(statusHistoryData as any)

    return NextResponse.json({
      success: true,
      parcel,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/parcels:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/parcels
 * Get parcels for the authenticated user (sender)
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

    if (profile.role !== 'sender') {
      return NextResponse.json(
        { error: 'Only senders can view their parcels' },
        { status: 403 }
      )
    }

    // Get parcels for this sender
    const { data: parcels, error: parcelsError } = await supabase
      .from('parcels')
      .select('*')
      .eq('sender_id', session.user.id)
      .order('created_at', { ascending: false })

    if (parcelsError) {
      console.error('Error fetching parcels:', parcelsError)
      return NextResponse.json(
        { error: 'Failed to fetch parcels', details: parcelsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      parcels: parcels || [],
    })
  } catch (error: any) {
    console.error('Error in GET /api/parcels:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


