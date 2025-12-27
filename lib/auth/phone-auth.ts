/**
 * Phone Authentication with Supabase + Twilio WhatsApp OTP
 * Uses Supabase Auth for phone authentication
 * Sends OTP via Twilio WhatsApp
 */

import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/client'
import { createWhatsAppClient } from '@/lib/whatsapp/client'

/**
 * Send OTP to phone number via WhatsApp
 * This is called after Supabase generates the OTP
 */
export async function sendOTPViaWhatsApp(phoneNumber: string, otp: string) {
  try {
    const whatsappClient = createWhatsAppClient()
    
    // Format phone number (remove + if present, add whatsapp: prefix)
    const formattedPhone = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+${phoneNumber}`
    
    const message = `Your QikParcel verification code is: ${otp}\n\nThis code will expire in 10 minutes.`
    
    await whatsappClient.sendTextMessage(formattedPhone, message)
    
    return { success: true }
  } catch (error: any) {
    console.error('Error sending WhatsApp OTP:', error)
    throw new Error(`Failed to send OTP: ${error.message}`)
  }
}

/**
 * Sign up with phone number
 * Step 1: Request OTP from Supabase
 * Step 2: Send OTP via WhatsApp
 */
export async function signUpWithPhone(phoneNumber: string) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Format phone number for Supabase (needs +country code)
    const formattedPhone = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+${phoneNumber}`
    
    // Request OTP from Supabase
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        // We'll send OTP via WhatsApp, so we can customize the message
        // Supabase will generate the OTP, we'll intercept and send via WhatsApp
      },
    })
    
    if (error) {
      throw error
    }
    
    // Note: Supabase will send SMS by default
    // We need to configure Supabase to use our custom provider or
    // Intercept the OTP and send via WhatsApp
    
    return { success: true, data }
  } catch (error: any) {
    console.error('Sign up error:', error)
    throw new Error(`Sign up failed: ${error.message}`)
  }
}

/**
 * Sign in with phone number
 * Same as sign up - Supabase handles both
 */
export async function signInWithPhone(phoneNumber: string) {
  return signUpWithPhone(phoneNumber) // Supabase uses same flow
}

/**
 * Verify OTP code
 */
export async function verifyOTP(phoneNumber: string, otp: string) {
  try {
    const supabase = createSupabaseServerClient()
    
    const formattedPhone = phoneNumber.startsWith('+')
      ? phoneNumber
      : `+${phoneNumber}`
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms', // or 'phone' depending on Supabase version
    })
    
    if (error) {
      throw error
    }
    
    // After successful verification, create/update profile
    if (data.user) {
      await createOrUpdateProfile(data.user.id, formattedPhone)
    }
    
    return { success: true, data }
  } catch (error: any) {
    console.error('OTP verification error:', error)
    throw new Error(`Verification failed: ${error.message}`)
  }
}

/**
 * Create or update user profile after authentication
 */
async function createOrUpdateProfile(userId: string, phoneNumber: string) {
  try {
    const supabase = createSupabaseAdminClient() // Use admin client to bypass RLS
    
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (existingProfile) {
      // Update existing profile
      await supabase
        .from('profiles')
        .update({
          phone_number: phoneNumber,
          whatsapp_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    } else {
      // Create new profile
      await supabase
        .from('profiles')
        .insert({
          id: userId,
          phone_number: phoneNumber,
          whatsapp_number: phoneNumber,
          role: 'sender', // Default role, can be changed later
        })
    }
  } catch (error) {
    console.error('Error creating/updating profile:', error)
    // Don't throw - profile creation is not critical for auth
  }
}

/**
 * Get current user session
 */
export async function getCurrentUser() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    return null
  }
  
  return user
}

/**
 * Sign out
 */
export async function signOut() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
}


