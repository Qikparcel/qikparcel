import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/client'
import { normalizePhoneNumber, normalizePhoneForComparison } from '@/lib/utils/phone'

/**
 * POST /api/auth/verify-otp
 * Verify OTP code and create user session
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json()
    
    // Get base URL for redirects (works in both local and production)
    const getBaseUrl = () => {
      // In production, always use the production domain
      if (process.env.NODE_ENV === 'production') {
        return 'https://app.qikparcel.com'
      }
      // Fallback to NEXT_PUBLIC_APP_URL if set (for local development)
      if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL
      }
      // Use request origin as last resort (for local development)
      return request.nextUrl.origin
    }

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

    // Normalize phone number to match how it was stored
    const formattedPhone = normalizePhoneNumber(phoneNumber)

    console.log('Verifying OTP:', {
      phoneNumber: formattedPhone,
      otpLength: otp.length,
    })

    // Verify OTP from our storage
    const adminSupabase = createSupabaseAdminClient()
    
    // First, let's check what OTPs exist for this phone number (for debugging)
    // @ts-ignore - TypeScript inference issue with otp_codes table, types are correct
    const { data: allOtps } = await adminSupabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', formattedPhone)
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('Found OTPs for phone:', {
      count: allOtps?.length || 0,
      // @ts-ignore
      otps: allOtps?.map((o: any) => ({ code: o.otp_code, used: o.used, expires_at: o.expires_at, created_at: o.created_at })),
    })
    
    // Find valid OTP
    // @ts-ignore - TypeScript inference issue with otp_codes table, types are correct
    const { data: otpData, error: otpError } = await adminSupabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', formattedPhone)
      .eq('otp_code', otp.toString()) // Ensure OTP is a string
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle() instead of single() to avoid errors

    if (otpError) {
      console.error('OTP lookup error:', otpError)
      return NextResponse.json(
        { error: 'Error verifying OTP', details: otpError.message },
        { status: 400 }
      )
    }

    if (!otpData) {
      console.log('OTP not found or invalid:', {
        phoneNumber: formattedPhone,
        providedOtp: otp,
        // @ts-ignore
        availableOtps: allOtps?.map((o: any) => o.otp_code),
      })
      return NextResponse.json(
        { error: 'Invalid or expired OTP code. Please request a new code.' },
        { status: 400 }
      )
    }

    console.log('OTP verified successfully:', {
      // @ts-ignore
      otpId: otpData.id,
      phoneNumber: formattedPhone,
    })

    // Mark OTP as used
    await (adminSupabase.from('otp_codes') as any)
      .update({ used: true })
      .eq('id', (otpData as any).id)

    // Create or get user account using Supabase Admin API
    // Since we're using WhatsApp for OTP (not Supabase SMS), we need to create users via admin API
    let user = null
    
    // Check if user already exists
    console.log('Checking for existing user with phone:', formattedPhone)
    const { data: usersData, error: listError } = await adminSupabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', {
        error: listError,
        message: listError.message,
        code: listError.status,
      })
      return NextResponse.json(
        { error: 'Failed to check existing users', details: listError.message },
        { status: 500 }
      )
    }

    console.log('Total users in system:', usersData?.users?.length || 0)
    
    const phoneForComparison = normalizePhoneForComparison(formattedPhone)
    let existingUser = usersData?.users?.find((u: any) => {
      const userPhone = u.phone || u.user_metadata?.phone || ''
      const normalizedUserPhone = normalizePhoneForComparison(userPhone)
      console.log('Comparing:', { 
        userPhone, 
        formattedPhone, 
        normalizedUserPhone, 
        phoneForComparison,
        match: normalizedUserPhone === phoneForComparison 
      })
      return normalizedUserPhone === phoneForComparison
    })
    
    if (existingUser) {
      console.log('✅ User already exists:', {
        id: existingUser.id,
        phone: existingUser.phone,
        email: existingUser.email,
      })
      user = existingUser
    } else {
      console.log('ℹ️ No existing user found, will create new one')
    }

    // If user doesn't exist, create new user using admin API
    if (!user) {
      console.log('📝 Creating new user for phone:', formattedPhone)
      
      // Generate a temporary email for the user (Supabase requires email)
      const tempEmail = `${formattedPhone.replace(/[^0-9]/g, '')}@qikparcel.local`
      console.log('Using temporary email:', tempEmail)
      
      const createUserPayload = {
        phone: formattedPhone,
        email: tempEmail,
        email_confirm: true, // Auto-confirm email
        phone_confirm: true, // Auto-confirm phone (we verified via OTP)
        user_metadata: {
          phone: formattedPhone,
        },
      }
      
      console.log('Creating user with payload:', { ...createUserPayload, phone: '[REDACTED]' })
      
      const { data: newUserData, error: createError } = await adminSupabase.auth.admin.createUser(createUserPayload)

      if (createError) {
        // If user already exists (email exists), try to find and use that user
        if (createError.code === 'email_exists' || createError.message?.includes('already been registered')) {
          console.log('⚠️ User creation failed - email exists, searching for existing user...')
          
          // Search for user by email
          const { data: searchUsersData } = await adminSupabase.auth.admin.listUsers()
          const foundUser = searchUsersData?.users?.find((u: any) => {
            const userPhone = u.phone || u.user_metadata?.phone || ''
            return normalizePhoneForComparison(userPhone) === phoneForComparison
          })
          
          if (foundUser) {
            console.log('✅ Found existing user:', foundUser.id)
            user = foundUser
          } else {
            console.error('❌ Error creating user and could not find existing user:', {
              error: createError,
              message: createError.message,
              code: createError.status,
            })
            return NextResponse.json(
              { error: 'Failed to create user account', details: createError.message, code: createError.status },
              { status: 500 }
            )
          }
        } else {
          console.error('❌ Error creating user:', {
            error: createError,
            message: createError.message,
            code: createError.status,
            details: JSON.stringify(createError, null, 2),
          })
          return NextResponse.json(
            { error: 'Failed to create user account', details: createError.message, code: createError.status },
            { status: 500 }
          )
        }
      }

      console.log('✅ User creation response:', {
        hasUser: !!newUserData?.user,
        userId: newUserData?.user?.id,
        userPhone: newUserData?.user?.phone,
        userEmail: newUserData?.user?.email,
      })

      if (newUserData?.user) {
        console.log('✅ User created successfully:', newUserData.user.id)
        user = newUserData.user
      } else {
        console.error('❌ User creation returned no user data:', newUserData)
        return NextResponse.json(
          { error: 'User creation succeeded but no user data returned', details: JSON.stringify(newUserData) },
          { status: 500 }
        )
      }
    }

    // Create or update user profile
    if (!user || !user.id) {
      console.error('❌ No user found or created:', { user })
      return NextResponse.json(
        { error: 'Failed to create user account - no user object returned' },
        { status: 500 }
      )
    }

    console.log('📋 Creating/updating profile for user:', user.id)

      // Check if profile exists
      // @ts-ignore - TypeScript inference issue with profiles table
      const { data: existingProfile, error: profileCheckError } = await (adminSupabase
        .from('profiles') as any)
      .select('*')
        .eq('id', user.id)
      .maybeSingle()

    if (profileCheckError) {
      console.error('❌ Error checking profile:', {
        error: profileCheckError,
        message: profileCheckError.message,
        code: profileCheckError.code,
        details: profileCheckError,
      })
    }

      if (existingProfile) {
      console.log('📝 Profile exists, updating...')
        // Update existing profile
      // @ts-ignore - TypeScript inference issue with profiles table
      const { data: updatedProfile, error: updateError } = await (adminSupabase
          .from('profiles') as any)
          .update({
            phone_number: formattedPhone,
            whatsapp_number: formattedPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        .select()
      
      if (updateError) {
        console.error('❌ Error updating profile:', {
          error: updateError,
          message: updateError.message,
          code: updateError.code,
          details: updateError,
        })
        return NextResponse.json(
          { error: 'Failed to update user profile', details: updateError.message, code: updateError.code },
          { status: 500 }
        )
      } else {
        console.log('✅ Profile updated successfully:', updatedProfile)
      }
    } else {
      console.log('📝 Profile does not exist, creating new one...')
        // Create new profile
      const profileData = {
            id: user.id,
            phone_number: formattedPhone,
            whatsapp_number: formattedPhone,
            role: 'sender', // Default role
      }
      
      console.log('Inserting profile with data:', { ...profileData, phone_number: '[REDACTED]' })
      
      // @ts-ignore - TypeScript inference issue with profiles table
      const { data: newProfile, error: insertError } = await (adminSupabase
        .from('profiles') as any)
        .insert(profileData)
        .select()
      
      if (insertError) {
        console.error('❌ Error creating profile:', {
          error: insertError,
          message: insertError.message,
          code: insertError.code,
          details: insertError,
          hint: insertError.hint,
        })
        return NextResponse.json(
          { 
            error: 'Failed to create user profile', 
            details: insertError.message,
            code: insertError.code,
            hint: insertError.hint,
          },
          { status: 500 }
        )
      } else {
        console.log('✅ Profile created successfully:', newProfile)
      }
    }

    // After OTP verification and user creation, we need to create a session
    // The simplest approach: Generate a recovery link which will allow the user to sign in
    // Client will redirect to this link, which sets auth cookies and redirects to dashboard
    
    const userEmail = user.email
    if (!userEmail) {
      console.error('User missing email:', user.id)
      return NextResponse.json(
        { error: 'User account is missing email address' },
        { status: 500 }
      )
    }

    console.log('Generating magic link for user:', {
      userId: user.id,
      email: userEmail,
    })

    // Use 'magiclink' type - works for both new and existing users
    // IMPORTANT: Redirect to /callback page which will handle tokens and set session cookies
    const baseUrl = getBaseUrl()
    console.log('[VERIFY-OTP] Using base URL for redirect:', baseUrl)
    const redirectUrl = `${baseUrl}/callback`
    console.log('[VERIFY-OTP] Full redirect URL:', redirectUrl)
    
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (linkError) {
      console.error('Failed to generate recovery link:', linkError)
      return NextResponse.json(
        { error: `Failed to create session link: ${linkError.message}` },
        { status: 500 }
      )
    }

    const actionLink = linkData?.properties?.action_link
    if (!actionLink) {
      console.error('No action_link in response:', linkData)
      return NextResponse.json(
        { error: 'Failed to generate session link' },
        { status: 500 }
      )
    }

    // Return the recovery link - client will redirect to it to complete authentication
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone || formattedPhone,
        email: userEmail,
      },
      redirectUrl: actionLink,
      message: 'OTP verified successfully',
    })
  } catch (error: any) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
