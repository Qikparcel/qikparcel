import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
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

    // Prevent self-deletion
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Use Admin API to delete the user from auth.users
    // This requires the service role key
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

    // Look up user profile using service role (avoid RLS issues)
    const { data: userToDelete } = await adminClient
      .from('profiles')
      .select('id, full_name, phone_number')
      .eq('id', userId)
      .maybeSingle<Pick<Profile, 'id' | 'full_name' | 'phone_number'>>()

    // Use the database function to safely delete the profile and all related data
    // This function handles cascading deletes properly
    const { error: functionError } = await adminClient.rpc('delete_user_cascade', {
      user_id: userId,
    } as any)

    if (functionError) {
      console.error('Error calling delete_user_cascade function:', functionError)
      // Fallback to manual deletion if function fails
      const { error: deleteProfileError } = await adminClient
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (deleteProfileError) {
        console.error('Error deleting profile (fallback):', deleteProfileError)
        return NextResponse.json(
          { error: 'Failed to delete user profile', details: deleteProfileError.message },
          { status: 500 }
        )
      }
    }

    // Now delete from auth.users using Admin API
    // This should work now that the profile is deleted
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('Error deleting user from auth:', deleteAuthError)
      return NextResponse.json(
        { error: 'Failed to delete user from auth', details: deleteAuthError.message },
        { status: 500 }
      )
    }

    // All related data (parcels, trips, etc.) will be automatically deleted
    // due to ON DELETE CASCADE constraints in the database schema

    return NextResponse.json({
      success: true,
      message: `User "${userToDelete?.full_name || userToDelete?.phone_number || userId}" deleted successfully`,
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/users/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
