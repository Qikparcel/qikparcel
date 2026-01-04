import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

/**
 * POST /api/auth/update-profile
 * Update user profile with additional information (address, email, documents)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      fullName, 
      role, 
      streetAddress, 
      addressLine2, 
      city, 
      state, 
      postcode, 
      country, 
      email, 
      documentPath, 
      documentType, 
      userId 
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const adminSupabase = createSupabaseAdminClient()

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (fullName) updateData.full_name = fullName
    if (role) updateData.role = role
    if (streetAddress) updateData.street_address = streetAddress
    if (addressLine2 !== undefined) updateData.address_line_2 = addressLine2
    if (city) updateData.city = city
    if (state) updateData.state = state
    if (postcode) updateData.postcode = postcode
    if (country) updateData.country = country
    if (email) updateData.email = email

    // Update profile
    const { error: updateError } = await (adminSupabase
      .from('profiles') as any)
      .update(updateData)
      .eq('id', userId)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json(
        { error: `Failed to update profile: ${updateError.message}` },
        { status: 500 }
      )
    }

        // If courier and document provided, update courier_kyc table
        if (role === 'courier' && documentPath) {
          const { error: kycError } = await (adminSupabase
            .from('courier_kyc') as any)
            .upsert({
              courier_id: userId,
              id_document_url: documentPath,
              id_document_type: documentType || 'national_id',
              verification_status: 'pending',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'courier_id',
            })

      if (kycError) {
        console.error('KYC update error:', kycError)
        // Don't fail the whole request if KYC update fails
        console.warn('Profile updated but KYC document update failed')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    })
  } catch (error: any) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    )
  }
}
