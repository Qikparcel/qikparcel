import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']

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


