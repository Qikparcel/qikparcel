import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type ParcelStatusHistoryInsert = Database['public']['Tables']['parcel_status_history']['Insert']

/**
 * POST /api/parcels/[id]/status
 * Update parcel status (for couriers)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parcelId = params.id
    const supabase = createClient()

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only couriers and admins can update parcel status
    if (profile.role !== 'courier' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only couriers can update parcel status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, notes, location } = body

    // Validate status
    const validStatuses = ['picked_up', 'in_transit', 'delivered', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const adminClient = createAdminClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get parcel to verify courier has access
    const { data: parcel, error: parcelError } = await adminClient
      .from('parcels')
      .select('id, status, matched_trip_id, sender_id')
      .eq('id', parcelId)
      .single<Parcel>()

    if (parcelError || !parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 })
    }

    // Verify parcel is matched to a trip
    if (!parcel.matched_trip_id) {
      return NextResponse.json(
        { error: 'Parcel is not matched to any trip' },
        { status: 400 }
      )
    }

    // Verify courier owns the matched trip
    const { data: trip, error: tripError } = await adminClient
      .from('trips')
      .select('courier_id')
      .eq('id', parcel.matched_trip_id)
      .single<Pick<Trip, 'courier_id'>>()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    if (profile.role !== 'admin' && trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only update status for parcels matched to your trips' },
        { status: 403 }
      )
    }

    // Validate status transitions
    const currentStatus = parcel.status
    const validTransitions: Record<string, string[]> = {
      matched: ['picked_up', 'cancelled'],
      picked_up: ['in_transit', 'cancelled'],
      in_transit: ['delivered', 'cancelled'],
      delivered: [], // Final state
      cancelled: [], // Final state
      pending: [], // Should not reach here
    }

    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${status}`,
          validTransitions: validTransitions[currentStatus] || [],
        },
        { status: 400 }
      )
    }

    // Update parcel status
    const { error: updateError } = await adminClient
      .from('parcels')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parcelId)

    if (updateError) {
      console.error('Error updating parcel status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update parcel status', details: updateError.message },
        { status: 500 }
      )
    }

    // Create status history entry
    const statusHistoryData: ParcelStatusHistoryInsert = {
      parcel_id: parcelId,
      status,
      notes: notes || null,
      location: location || null,
    }

    await adminClient
      .from('parcel_status_history')
      .insert(statusHistoryData as any)

    return NextResponse.json({
      success: true,
      message: `Parcel status updated to ${status}`,
      status,
    })
  } catch (error: any) {
    console.error('Error in POST /api/parcels/[id]/status:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
