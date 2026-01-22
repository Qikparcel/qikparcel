import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']

/**
 * GET /api/courier/matched-parcels
 * Get all parcels matched to the current courier's trips
 */
export async function GET(request: NextRequest) {
  try {
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

    // Only couriers and admins can access this
    if (profile.role !== 'courier' && profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only couriers can view matched parcels' },
        { status: 403 }
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

    // Get all trips for this courier
    const { data: trips, error: tripsError } = await adminClient
      .from('trips')
      .select('id')
      .eq('courier_id', session.user.id)

    if (tripsError) {
      console.error('Error fetching trips:', tripsError)
      return NextResponse.json(
        { error: 'Failed to fetch trips', details: tripsError.message },
        { status: 500 }
      )
    }

    if (!trips || trips.length === 0) {
      return NextResponse.json({
        success: true,
        parcels: [],
      })
    }

    const tripIds = (trips as Array<{ id: string }>).map((t) => t.id)

    // Get all parcels matched to these trips
    // Fetch parcels first, then fetch related data separately to avoid foreign key issues
    const { data: parcels, error: parcelsError } = await adminClient
      .from('parcels')
      .select('*')
      .in('matched_trip_id', tripIds)
      .in('status', ['matched', 'picked_up', 'in_transit', 'delivered'])
      .order('created_at', { ascending: false })

    if (parcelsError) {
      console.error('Error fetching parcels:', parcelsError)
      return NextResponse.json(
        { error: 'Failed to fetch parcels', details: parcelsError.message },
        { status: 500 }
      )
    }

    if (!parcels || parcels.length === 0) {
      return NextResponse.json({
        success: true,
        parcels: [],
      })
    }

    // Fetch trip and sender data separately
    const tripIdsForParcels = Array.from(new Set(parcels.map((p: Parcel) => p.matched_trip_id).filter(Boolean) as string[]))
    const senderIds = Array.from(new Set(parcels.map((p: Parcel) => p.sender_id)))

    // Fetch trips
    const { data: tripsData, error: tripsDataError } = await adminClient
      .from('trips')
      .select('id, origin_address, destination_address, departure_time, estimated_arrival, status')
      .in('id', tripIdsForParcels)

    if (tripsDataError) {
      console.error('Error fetching trips data:', tripsDataError)
    }

    // Fetch sender profiles
    const { data: sendersData, error: sendersError } = await adminClient
      .from('profiles')
      .select('id, full_name, phone_number, whatsapp_number')
      .in('id', senderIds)

    if (sendersError) {
      console.error('Error fetching senders data:', sendersError)
    }

    // Create maps for quick lookup
    const tripMap = new Map()
    if (tripsData) {
      tripsData.forEach((trip: any) => {
        tripMap.set(trip.id, trip)
      })
    }

    const senderMap = new Map()
    if (sendersData) {
      sendersData.forEach((sender: any) => {
        senderMap.set(sender.id, sender)
      })
    }

    // Combine parcels with trip and sender data
    const processedParcels = parcels.map((parcel: Parcel) => {
      const matchedTrip = parcel.matched_trip_id ? tripMap.get(parcel.matched_trip_id) || null : null
      const sender = senderMap.get(parcel.sender_id) || null

      return {
        ...parcel,
        matched_trip: matchedTrip,
        sender,
      }
    })

    return NextResponse.json({
      success: true,
      parcels: processedParcels,
    })
  } catch (error: any) {
    console.error('Error in GET /api/courier/matched-parcels:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
