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

    // Validate required fields for both sender and courier
    if (fullName !== undefined && !fullName?.trim()) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      )
    }

    const adminSupabase = createSupabaseAdminClient()

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Always update these fields if provided (even if empty string for optional fields)
    // These fields apply to both sender and courier
    if (fullName !== undefined && fullName !== null) updateData.full_name = fullName.trim()
    if (role !== undefined && role !== null) updateData.role = role
    if (streetAddress !== undefined && streetAddress !== null) updateData.street_address = streetAddress.trim()
    if (addressLine2 !== undefined) updateData.address_line_2 = addressLine2?.trim() || null
    if (city !== undefined && city !== null) updateData.city = city.trim()
    if (state !== undefined && state !== null) updateData.state = state.trim()
    if (postcode !== undefined && postcode !== null) updateData.postcode = postcode.trim()
    if (country !== undefined && country !== null) updateData.country = country.trim()
    // Email is optional and only for sender, but we can set it for courier too if provided
    if (email !== undefined) updateData.email = email?.trim() || null

    console.log('Updating profile with data:', {
      userId,
      hasFullName: !!fullName,
      hasRole: !!role,
      hasStreetAddress: !!streetAddress,
      hasAddressLine2: addressLine2 !== undefined,
      hasCity: !!city,
      hasState: !!state,
      hasPostcode: !!postcode,
      hasCountry: !!country,
      hasEmail: email !== undefined,
      updateDataKeys: Object.keys(updateData),
    })

    // Update profile
    const { data: updatedProfile, error: updateError } = await (adminSupabase
      .from('profiles') as any)
      .update(updateData)
      .eq('id', userId)
      .select()

    if (updateError) {
      console.error('Profile update error:', {
        error: updateError,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code,
        userId,
        updateData,
      })
      return NextResponse.json(
        { error: `Failed to update profile: ${updateError.message}`, details: updateError.details, hint: updateError.hint },
        { status: 500 }
      )
    }

    console.log('Profile updated successfully:', {
      userId,
      updatedFields: Object.keys(updateData),
      updatedProfile: updatedProfile?.[0] ? {
        full_name: updatedProfile[0].full_name,
        role: updatedProfile[0].role,
        street_address: updatedProfile[0].street_address,
        city: updatedProfile[0].city,
        country: updatedProfile[0].country,
      } : null,
    })

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
