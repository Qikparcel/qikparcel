/**
 * Notification service for matching events
 * Sends WhatsApp notifications to couriers and senders
 */

import { createWhatsAppClient } from '@/lib/whatsapp/client'
import { Database } from '@/types/database'
import { SupabaseClient } from '@supabase/supabase-js'

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
  try {
    // Get match with all details
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

    if (matchError || !matchData) {
      console.error(`[NOTIFICATIONS] Error fetching match ${matchId}:`, matchError)
      return
    }

    // Supabase returns the structure differently with joins
    const match = matchData as any
    const parcel = match.parcel as Parcel
    const trip = match.trip as Trip & {
      courier: Pick<Profile, 'whatsapp_number' | 'full_name' | 'phone_number'>
    }

    const courierWhatsApp = trip.courier?.whatsapp_number || trip.courier?.phone_number

    if (!courierWhatsApp) {
      console.log(
        `[NOTIFICATIONS] Courier ${trip.courier_id} has no WhatsApp number, skipping notification`
      )
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
    
    const whatsappClient = createWhatsAppClient()
    
    // Try to use template if available
    const templateSid = process.env.TWILIO_PARCEL_MATCH_TEMPLATE_SID
    if (templateSid) {
      // Use template with variables
      await whatsappClient.sendContentTemplate(courierWhatsApp, templateSid, {
        '1': parcel.pickup_address,
        '2': parcel.delivery_address,
        '3': trip.origin_address,
        '4': trip.destination_address,
        '5': trip.departure_time ? new Date(trip.departure_time).toLocaleString() : 'TBD',
        '6': match.match_score ? `${match.match_score}/100` : 'N/A',
        '7': parcel.description || 'No description',
        '8': parcel.weight_kg ? `${parcel.weight_kg} kg` : 'Not specified'
      })
    } else {
      // Fallback to text message (works in sandbox, but requires template in production)
      console.warn('[NOTIFICATIONS] No template SID found. Using text message (sandbox mode only). Create a template in Twilio for production.')
      await whatsappClient.sendTextMessage(courierWhatsApp, message)
    }

    console.log(`[NOTIFICATIONS] Sent match notification to courier ${courierWhatsApp}`)
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

    // Send WhatsApp message
    // TODO: Switch to sendContentTemplate() when template is created in Twilio
    const whatsappClient = createWhatsAppClient()
    
    // Try to use template if available
    const templateSid = process.env.TWILIO_PARCEL_ACCEPTED_TEMPLATE_SID
    if (templateSid) {
      await whatsappClient.sendContentTemplate(senderWhatsApp, templateSid, {
        '1': courierName,
        '2': parcel.pickup_address,
        '3': parcel.delivery_address,
        '4': trip.origin_address,
        '5': trip.destination_address,
        '6': trip.departure_time ? new Date(trip.departure_time).toLocaleString() : 'TBD',
        '7': trip.courier?.whatsapp_number || trip.courier?.phone_number || 'N/A'
      })
    } else {
      // Fallback to text message (works in sandbox, but requires template in production)
      console.warn('[NOTIFICATIONS] No template SID found. Using text message (sandbox mode only). Create a template in Twilio for production.')
      await whatsappClient.sendTextMessage(senderWhatsApp, message)
    }

    console.log(`[NOTIFICATIONS] Sent acceptance notification to sender ${senderWhatsApp}`)
  } catch (error) {
    console.error(
      `[NOTIFICATIONS] Error notifying sender of accepted match ${matchId}:`,
      error
    )
    // Don't throw - notification failures shouldn't break the matching process
  }
}
