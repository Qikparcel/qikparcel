import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase service role key')
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

    // Get stats (use service role to avoid RLS issues)
    const [usersResult, parcelsResult, tripsResult] = await Promise.all([
      adminClient.from('profiles').select('role', { count: 'exact', head: true }),
      adminClient.from('parcels').select('status', { count: 'exact', head: true }),
      adminClient.from('trips').select('status', { count: 'exact', head: true }),
    ])

    // Get detailed counts
    const [sendersResult, couriersResult, adminsResult, pendingParcelsResult, pendingTripsResult] = await Promise.all([
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'sender'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'courier'),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      adminClient.from('parcels').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      adminClient.from('trips').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: usersResult.count || 0,
        totalSenders: sendersResult.count || 0,
        totalCouriers: couriersResult.count || 0,
        totalAdmins: adminsResult.count || 0,
        totalParcels: parcelsResult.count || 0,
        totalTrips: tripsResult.count || 0,
        pendingParcels: pendingParcelsResult.count || 0,
        pendingTrips: pendingTripsResult.count || 0,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/stats:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
