/**
 * Notification service for matching events
 * Sends WhatsApp notifications to couriers and senders
 */

import { createWhatsAppClient } from '@/lib/whatsapp/client'
import { Database } from '@/types/database'
import { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/client'

type Match = Database['public']['Tables']['parcel_trip_matches']['Row']
type Parcel = Database['public']['Tables']['parcels']['Row']
type Trip = Database['public']['Tables']['trips']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface MatchWithDetails {
  match: Match
  parcel: Parcel
  trip: Trip
  senderProfile?: Pick<Profile, 'whatsapp_number' | 'full_name' | 'phone_number'>
  courierProfile?: Pick<Profile, 'whatsapp_number' | 'full_name' | 'phone_number'>
}

/**
 * Notify courier when a parcel matches their trip
 */
export async function notifyCourierOfMatch(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<void> {
  console.log(`[NOTIFICATIONS] Starting notification for match ${matchId}`)
  
  try {
    // Get match with all details
    console.log(`[NOTIFICATIONS] Fetching match data for ${matchId}`)
    const { data: matchData, error: matchError } = await supabase
      .from('parcel_trip_matches')
      .select(
        `
        *,
        parcel:parcels!parcel_trip_matches_parcel_id_fkey(*),
        trip:trips!parcel_trip_matches_trip_id_fkey(
          *,
          courier:profiles!trips_courier_id_fkey(
            whatsapp_number,
            full_name,
            phone_number
          )
        )
      `
      )
      .eq('id', matchId)
      .single()

    if (matchError) {
      console.error(`[NOTIFICATIONS] Error fetching match ${matchId}:`, matchError)
      console.error(`[NOTIFICATIONS] Match error details:`, JSON.stringify(matchError, null, 2))
      return
    }

    if (!matchData) {
      console.error(`[NOTIFICATIONS] No match data found for ${matchId}`)
      return
    }

    console.log(`[NOTIFICATIONS] Match data fetched successfully`)

    // Supabase returns the structure differently with joins
    const match = matchData as any
    const parcel = match.parcel as Parcel
    const trip = match.trip as Trip & {
      courier: Pick<Profile, 'whatsapp_number' | 'full_name' | 'phone_number'>
    }

    console.log(`[NOTIFICATIONS] Match details:`, {
      matchId,
      parcelId: parcel?.id,
      tripId: trip?.id,
      courierId: trip?.courier_id,
      courierData: trip?.courier
    })

    if (!parcel) {
      console.error(`[NOTIFICATIONS] Parcel not found in match data`)
      return
    }

    if (!trip) {
      console.error(`[NOTIFICATIONS] Trip not found in match data`)
      return
    }

    // Fetch courier profile separately using admin client to bypass RLS
    let courierWhatsApp = trip.courier?.whatsapp_number || trip.courier?.phone_number
    
    if (!courierWhatsApp && trip.courier_id) {
      console.log(`[NOTIFICATIONS] Courier profile not in join, fetching separately...`)
      try {
        const adminClient = createSupabaseAdminClient()
        const { data: courierProfile, error: profileError } = await adminClient
          .from('profiles')
          .select('whatsapp_number, phone_number, full_name')
          .eq('id', trip.courier_id)
          .single()

        if (profileError) {
          console.error(`[NOTIFICATIONS] Error fetching courier profile:`, profileError)
        } else if (courierProfile) {
          const profile = courierProfile as Pick<Profile, 'whatsapp_number' | 'phone_number' | 'full_name'>
          courierWhatsApp = profile.whatsapp_number || profile.phone_number
          console.log(`[NOTIFICATIONS] Fetched courier profile separately:`, {
            whatsappNumber: profile.whatsapp_number,
            phoneNumber: profile.phone_number,
            resolvedWhatsApp: courierWhatsApp
          })
        }
      } catch (error) {
        console.error(`[NOTIFICATIONS] Exception fetching courier profile:`, error)
      }
    }

    console.log(`[NOTIFICATIONS] Courier contact info:`, {
      courierId: trip.courier_id,
      whatsappNumber: trip.courier?.whatsapp_number,
      phoneNumber: trip.courier?.phone_number,
      resolvedWhatsApp: courierWhatsApp
    })

    if (!courierWhatsApp) {
      console.warn(
        `[NOTIFICATIONS] Courier ${trip.courier_id} has no WhatsApp number or phone number, skipping notification`
      )
      console.warn(`[NOTIFICATIONS] Courier profile data from join:`, trip.courier)
      return
    }

    // Build notification message
    // NOTE: For WhatsApp Business API, you MUST use a pre-approved message template
    // for outbound messages (messages not in response to user within 24h).
    // 
    // Steps to set up:
    // 1. Go to Twilio Console > Content > Templates
    // 2. Create a new template with the following structure:
    //    - Template name: "parcel_match_notification"
    //    - Category: "UTILITY" or "MARKETING"
    //    - Variables: {{1}} (pickup), {{2}} (delivery), {{3}} (origin), {{4}} (destination), {{5}} (departure)
    // 3. Get the Content SID from the template
    // 4. Set TWILIO_PARCEL_MATCH_TEMPLATE_SID in environment variables
    // 5. Update this function to use sendContentTemplate() instead of sendTextMessage()
    //
    // For now, using sendTextMessage() which works in sandbox mode but requires templates in production.
    
    const matchScore = match.match_score ? `Match Score: ${match.match_score}/100\n` : ''
    const message = `🚚 New Parcel Match Available!

${matchScore}
Parcel Details:
📍 Pickup: ${parcel.pickup_address}
📦 Delivery: ${parcel.delivery_address}
${parcel.description ? `📝 Description: ${parcel.description}\n` : ''}
${parcel.weight_kg ? `⚖️ Weight: ${parcel.weight_kg} kg\n` : ''}

This parcel matches your trip:
🚀 From: ${trip.origin_address}
🏁 To: ${trip.destination_address}
${trip.departure_time ? `⏰ Departure: ${new Date(trip.departure_time).toLocaleString()}\n` : ''}

View and accept this match in your dashboard to get started!`

    // Send WhatsApp message
    // TODO: Switch to sendContentTemplate() when template is created in Twilio
    // Example:
    // const templateSid = process.env.TWILIO_PARCEL_MATCH_TEMPLATE_SID
    // if (templateSid) {
    //   await whatsappClient.sendContentTemplate(courierWhatsApp, templateSid, {
    //     '1': parcel.pickup_address,
    //     '2': parcel.delivery_address,
    //     '3': trip.origin_address,
    //     '4': trip.destination_address,
    //     '5': trip.departure_time ? new Date(trip.departure_time).toLocaleString() : 'TBD'
    //   })
    // } else {
    //   // Fallback to text message (sandbox mode only)
    //   await whatsappClient.sendTextMessage(courierWhatsApp, message)
    // }
    
    console.log(`[NOTIFICATIONS] Creating WhatsApp client...`)
    const whatsappClient = createWhatsAppClient()
    
    // Use the pre-created template content ID
    // Template Content ID: HX3479df42d9ecc2f9bc0b94e2a8514391
    // Message: "New Parcel Match\nA parcel has been matched to your trip and is awaiting your acceptance.\nPlease review the details and accept or decline them in the app."
    const templateContentId = process.env.TWILIO_PARCEL_MATCH_TEMPLATE_SID || 'HX3479df42d9ecc2f9bc0b94e2a8514391'
    
    console.log(`[NOTIFICATIONS] Attempting to send WhatsApp message:`, {
      to: courierWhatsApp,
      templateId: templateContentId,
      hasEnvVar: !!process.env.TWILIO_PARCEL_MATCH_TEMPLATE_SID
    })
    
    try {
      // Send using the template (no variables needed based on the template content)
      console.log(`[NOTIFICATIONS] Sending template message to ${courierWhatsApp}...`)
      const result = await whatsappClient.sendContentTemplate(courierWhatsApp, templateContentId)
      console.log(`[NOTIFICATIONS] ✅ Successfully sent match notification to courier ${courierWhatsApp} using template ${templateContentId}`)
      console.log(`[NOTIFICATIONS] Twilio response:`, {
        messageSid: result.sid,
        status: result.status
      })
    } catch (error: any) {
      console.error(`[NOTIFICATIONS] ❌ Error sending template message:`, error)
      console.error(`[NOTIFICATIONS] Error details:`, {
        message: error.message,
        code: error.code,
        userMessage: error.userMessage,
        stack: error.stack
      })
      
      // Fallback to text message if template fails
      console.log(`[NOTIFICATIONS] Attempting fallback text message...`)
      try {
        await whatsappClient.sendTextMessage(courierWhatsApp, message)
        console.log(`[NOTIFICATIONS] ✅ Sent fallback text message to courier ${courierWhatsApp}`)
      } catch (fallbackError: any) {
        console.error(`[NOTIFICATIONS] ❌ Failed to send both template and text message:`, fallbackError)
        console.error(`[NOTIFICATIONS] Fallback error details:`, {
          message: fallbackError.message,
          code: fallbackError.code,
          userMessage: fallbackError.userMessage,
          stack: fallbackError.stack
        })
        throw fallbackError
      }
    }
  } catch (error) {
    console.error(`[NOTIFICATIONS] Error notifying courier of match ${matchId}:`, error)
    // Don't throw - notification failures shouldn't break the matching process
  }
}

/**
 * Notify sender when courier accepts their parcel match
 */
export async function notifySenderOfAcceptedMatch(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<void> {
  try {
    // Get match with all details
    const { data: matchData, error: matchError } = await supabase
      .from('parcel_trip_matches')
      .select(
        `
        *,
        parcel:parcels!parcel_trip_matches_parcel_id_fkey(
          *,
          sender:profiles!parcels_sender_id_fkey(
            whatsapp_number,
            full_name,
            phone_number
          )
        ),
        trip:trips!parcel_trip_matches_trip_id_fkey(
          *,
          courier:profiles!trips_courier_id_fkey(
            full_name,
            phone_number,
            whatsapp_number
          )
        )
      `
      )
      .eq('id', matchId)
      .single()

    if (matchError || !matchData) {
      console.error(`[NOTIFICATIONS] Error fetching match ${matchId}:`, matchError)
      return
    }

    // Supabase returns the structure differently with joins
    const match = matchData as any
    const parcel = match.parcel as Parcel & {
      sender: Pick<Profile, 'whatsapp_number' | 'full_name' | 'phone_number'>
    }
    const trip = match.trip as Trip & {
      courier: Pick<Profile, 'full_name' | 'phone_number' | 'whatsapp_number'>
    }

    const senderWhatsApp =
      parcel.sender?.whatsapp_number || parcel.sender?.phone_number

    if (!senderWhatsApp) {
      console.log(
        `[NOTIFICATIONS] Sender ${parcel.sender_id} has no WhatsApp number, skipping notification`
      )
      return
    }

    const courierName =
      trip.courier?.full_name || trip.courier?.phone_number || 'A courier'

    // Build notification message
    // NOTE: For WhatsApp Business API, you MUST use a pre-approved message template
    // See notifyCourierOfMatch() above for template setup instructions
    const message = `✅ Your Parcel Has Been Matched!

Great news! ${courierName} has accepted your parcel delivery request.

📦 Parcel Details:
📍 Pickup: ${parcel.pickup_address}
🏁 Delivery: ${parcel.delivery_address}

🚚 Courier Trip:
From: ${trip.origin_address}
To: ${trip.destination_address}
${trip.departure_time ? `⏰ Departure: ${new Date(trip.departure_time).toLocaleString()}\n` : ''}

${trip.courier?.whatsapp_number ? `Contact: ${trip.courier.whatsapp_number}\n` : ''}

You can track your parcel status in your dashboard. Thank you for using QikParcel!`

    // Send WhatsApp message using Twilio Content Template
    const whatsappClient = createWhatsAppClient()
    
    // Use the pre-created template content ID
    // Template Content ID: HX6092c1e14a50ab625e62df98279493
    // Message: "Parcel Update\nGood news! Your parcel has been successfully matched with a courier for the trip, and the courier has accepted it.\nYou can track the progress in our app."
    const templateContentId = process.env.TWILIO_PARCEL_ACCEPTED_TEMPLATE_SID || 'HX6092c1e14a50ab625e62df98279493'
    
    try {
      // Send using the template (no variables needed based on the template content)
      await whatsappClient.sendContentTemplate(senderWhatsApp, templateContentId)
      console.log(`[NOTIFICATIONS] Sent acceptance notification to sender ${senderWhatsApp} using template ${templateContentId}`)
    } catch (error: any) {
      console.error(`[NOTIFICATIONS] Error sending template message, falling back to text message:`, error)
      // Fallback to text message if template fails
      try {
        await whatsappClient.sendTextMessage(senderWhatsApp, message)
        console.log(`[NOTIFICATIONS] Sent fallback text message to sender ${senderWhatsApp}`)
      } catch (fallbackError) {
        console.error(`[NOTIFICATIONS] Failed to send both template and text message:`, fallbackError)
        throw fallbackError
      }
    }
  } catch (error) {
    console.error(
      `[NOTIFICATIONS] Error notifying sender of accepted match ${matchId}:`,
      error
    )
    // Don't throw - notification failures shouldn't break the matching process
  }
}
