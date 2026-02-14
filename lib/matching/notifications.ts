/**
 * Notification service for matching events
 * Sends WhatsApp notifications to couriers and senders
 */

import { createWhatsAppClient } from "@/lib/whatsapp/client";
import { Database } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface MatchWithDetails {
  match: Match;
  parcel: Parcel;
  trip: Trip;
  senderProfile?: Pick<
    Profile,
    "whatsapp_number" | "full_name" | "phone_number"
  >;
  courierProfile?: Pick<
    Profile,
    "whatsapp_number" | "full_name" | "phone_number"
  >;
}

/**
 * Notify courier when a parcel matches their trip
 */
export async function notifyCourierOfMatch(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<void> {
  console.log(`[NOTIFICATIONS] Starting notification for match ${matchId}`);

  try {
    // Get match with all details
    console.log(`[NOTIFICATIONS] Fetching match data for ${matchId}`);
    const { data: matchData, error: matchError } = await supabase
      .from("parcel_trip_matches")
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
      .eq("id", matchId)
      .single();

    if (matchError) {
      console.error(
        `[NOTIFICATIONS] Error fetching match ${matchId}:`,
        matchError
      );
      console.error(
        `[NOTIFICATIONS] Match error details:`,
        JSON.stringify(matchError, null, 2)
      );
      return;
    }

    if (!matchData) {
      console.error(`[NOTIFICATIONS] No match data found for ${matchId}`);
      return;
    }

    console.log(`[NOTIFICATIONS] Match data fetched successfully`);

    // Supabase returns the structure differently with joins
    const match = matchData as any;
    const parcel = match.parcel as Parcel;
    const trip = match.trip as Trip & {
      courier: Pick<Profile, "whatsapp_number" | "full_name" | "phone_number">;
    };

    console.log(`[NOTIFICATIONS] Match details:`, {
      matchId,
      parcelId: parcel?.id,
      tripId: trip?.id,
      courierId: trip?.courier_id,
      courierData: trip?.courier,
    });

    if (!parcel) {
      console.error(`[NOTIFICATIONS] Parcel not found in match data`);
      return;
    }

    if (!trip) {
      console.error(`[NOTIFICATIONS] Trip not found in match data`);
      return;
    }

    // Fetch courier profile separately using admin client to bypass RLS
    let courierWhatsApp =
      trip.courier?.whatsapp_number || trip.courier?.phone_number;

    if (!courierWhatsApp && trip.courier_id) {
      console.log(
        `[NOTIFICATIONS] Courier profile not in join, fetching separately...`
      );
      try {
        const adminClient = createSupabaseAdminClient();
        const { data: courierProfile, error: profileError } = await adminClient
          .from("profiles")
          .select("whatsapp_number, phone_number, full_name")
          .eq("id", trip.courier_id)
          .single();

        if (profileError) {
          console.error(
            `[NOTIFICATIONS] Error fetching courier profile:`,
            profileError
          );
        } else if (courierProfile) {
          const profile = courierProfile as Pick<
            Profile,
            "whatsapp_number" | "phone_number" | "full_name"
          >;
          courierWhatsApp = profile.whatsapp_number || profile.phone_number;
          console.log(`[NOTIFICATIONS] Fetched courier profile separately:`, {
            whatsappNumber: profile.whatsapp_number,
            phoneNumber: profile.phone_number,
            resolvedWhatsApp: courierWhatsApp,
          });
        }
      } catch (error) {
        console.error(
          `[NOTIFICATIONS] Exception fetching courier profile:`,
          error
        );
      }
    }

    console.log(`[NOTIFICATIONS] Courier contact info:`, {
      courierId: trip.courier_id,
      whatsappNumber: trip.courier?.whatsapp_number,
      phoneNumber: trip.courier?.phone_number,
      resolvedWhatsApp: courierWhatsApp,
    });

    if (!courierWhatsApp) {
      console.warn(
        `[NOTIFICATIONS] Courier ${trip.courier_id} has no WhatsApp number or phone number, skipping notification`
      );
      console.warn(
        `[NOTIFICATIONS] Courier profile data from join:`,
        trip.courier
      );
      return;
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

    const matchScore = match.match_score
      ? `Match Score: ${match.match_score}/100\n`
      : "";
    const message = `🚚 New Parcel Match Available!

${matchScore}
Parcel Details:
📍 Pickup: ${parcel.pickup_address}
📦 Delivery: ${parcel.delivery_address}
${parcel.description ? `📝 Description: ${parcel.description}\n` : ""}
${parcel.weight_kg ? `⚖️ Weight: ${parcel.weight_kg} kg\n` : ""}

This parcel matches your trip:
🚀 From: ${trip.origin_address}
🏁 To: ${trip.destination_address}
${
  trip.departure_time
    ? `⏰ Departure: ${new Date(trip.departure_time).toLocaleString()}\n`
    : ""
}

View and accept this match in your dashboard to get started!`;

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

    console.log(`[NOTIFICATIONS] Creating WhatsApp client...`);
    const whatsappClient = createWhatsAppClient();

    // Use the pre-created template content ID
    // Template Content ID: HX3479df42d9ecc2f9bc0b94e2a8514391
    // Message: "New Parcel Match\nA parcel has been matched to your trip and is awaiting your acceptance.\nPlease review the details and accept or decline them in the app."
    const templateContentId = process.env.TWILIO_PARCEL_MATCH_TEMPLATE_SID;

    if (!templateContentId) {
      console.error(
        `[NOTIFICATIONS] TWILIO_PARCEL_MATCH_TEMPLATE_SID not configured`
      );
      throw new Error(
        "WhatsApp template not configured. Please set TWILIO_PARCEL_MATCH_TEMPLATE_SID environment variable."
      );
    }

    console.log(`[NOTIFICATIONS] Attempting to send WhatsApp message:`, {
      to: courierWhatsApp,
      templateId: templateContentId,
    });

    try {
      // Send using the template - NO VARIABLES NEEDED
      // These templates are static messages with no placeholders
      // Do NOT pass a third parameter (contentVariables) - it will cause errors
      console.log(
        `[NOTIFICATIONS] Sending template message to ${courierWhatsApp}...`
      );
      console.log(
        `[NOTIFICATIONS] Using template Content SID: ${templateContentId}`
      );
      console.log(
        `[NOTIFICATIONS] NOT sending any template variables (template is static)`
      );
      const result = await whatsappClient.sendContentTemplate(
        courierWhatsApp,
        templateContentId
        // Intentionally NOT passing third parameter - no variables needed
      );
      console.log(
        `[NOTIFICATIONS] ✅ Successfully sent match notification to courier ${courierWhatsApp} using template ${templateContentId}`
      );
      console.log(`[NOTIFICATIONS] Twilio response:`, {
        messageSid: result.sid,
        status: result.status,
      });
    } catch (error: any) {
      console.error(
        `[NOTIFICATIONS] ❌ Error sending template message:`,
        error
      );
      console.error(`[NOTIFICATIONS] Error details:`, {
        message: error.message,
        code: error.code,
        userMessage: error.userMessage,
        templateContentId,
        stack: error.stack,
      });

      // DO NOT fallback to free-form text - Twilio blocks it in production
      // Template must be approved and configured correctly
      console.error(
        `[NOTIFICATIONS] ⚠️ Template send failed. Cannot use free-form messages. Please ensure:`
      );
      console.error(
        `[NOTIFICATIONS] 1. Template Content SID ${templateContentId} is correct and approved in Twilio`
      );
      console.error(
        `[NOTIFICATIONS] 2. TWILIO_PARCEL_MATCH_TEMPLATE_SID is set in environment variables`
      );
      console.error(
        `[NOTIFICATIONS] 3. Template is approved and active in Twilio Console`
      );

      // Re-throw so caller knows notification failed
      throw error;
    }
  } catch (error) {
    console.error(
      `[NOTIFICATIONS] Error notifying courier of match ${matchId}:`,
      error
    );
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
      .from("parcel_trip_matches")
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
      .eq("id", matchId)
      .single();

    if (matchError || !matchData) {
      console.error(
        `[NOTIFICATIONS] Error fetching match ${matchId}:`,
        matchError
      );
      return;
    }

    // Supabase returns the structure differently with joins
    const match = matchData as any;
    const parcel = match.parcel as Parcel & {
      sender: Pick<Profile, "whatsapp_number" | "full_name" | "phone_number">;
    };
    const trip = match.trip as Trip & {
      courier: Pick<Profile, "full_name" | "phone_number" | "whatsapp_number">;
    };

    const senderWhatsApp =
      parcel.sender?.whatsapp_number || parcel.sender?.phone_number;

    if (!senderWhatsApp) {
      console.log(
        `[NOTIFICATIONS] Sender ${parcel.sender_id} has no WhatsApp number, skipping notification`
      );
      return;
    }

    const courierName =
      trip.courier?.full_name || trip.courier?.phone_number || "A courier";

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
${
  trip.departure_time
    ? `⏰ Departure: ${new Date(trip.departure_time).toLocaleString()}\n`
    : ""
}

${
  trip.courier?.whatsapp_number
    ? `Contact: ${trip.courier.whatsapp_number}\n`
    : ""
}

You can track your parcel status in your dashboard. Thank you for using QikParcel!`;

    // Send WhatsApp message using Twilio Content Template
    const whatsappClient = createWhatsAppClient();

    // Use the pre-created template content ID
    // Template Content ID: HX6092c1e14a50ab625e62df982bd79493
    // Message: "Parcel Update\nGood news! Your parcel has been successfully matched with a courier for the trip, and the courier has accepted it.\nYou can track the progress in our app."
    const templateContentId = process.env.TWILIO_PARCEL_ACCEPTED_TEMPLATE_SID;

    if (!templateContentId) {
      console.error(
        `[NOTIFICATIONS] TWILIO_PARCEL_ACCEPTED_TEMPLATE_SID not configured`
      );
      throw new Error(
        "WhatsApp template not configured. Please set TWILIO_PARCEL_ACCEPTED_TEMPLATE_SID environment variable."
      );
    }

    try {
      // Send using the template - NO VARIABLES NEEDED
      // These templates are static messages with no placeholders
      // Do NOT pass a third parameter (contentVariables) - it will cause errors
      console.log(
        `[NOTIFICATIONS] Sending template message to sender ${senderWhatsApp}...`
      );
      console.log(
        `[NOTIFICATIONS] Using template Content SID: ${templateContentId}`
      );
      console.log(
        `[NOTIFICATIONS] NOT sending any template variables (template is static)`
      );
      await whatsappClient.sendContentTemplate(
        senderWhatsApp,
        templateContentId
        // Intentionally NOT passing third parameter - no variables needed
      );
      console.log(
        `[NOTIFICATIONS] ✅ Sent acceptance notification to sender ${senderWhatsApp} using template ${templateContentId}`
      );
    } catch (error: any) {
      console.error(
        `[NOTIFICATIONS] ❌ Error sending template message:`,
        error
      );
      console.error(`[NOTIFICATIONS] Error details:`, {
        message: error.message,
        code: error.code,
        userMessage: error.userMessage,
        templateContentId,
        stack: error.stack,
      });

      // DO NOT fallback to free-form text - Twilio blocks it in production
      // Template must be approved and configured correctly
      console.error(
        `[NOTIFICATIONS] ⚠️ Template send failed. Cannot use free-form messages. Please ensure:`
      );
      console.error(
        `[NOTIFICATIONS] 1. Template Content SID ${templateContentId} is correct and approved in Twilio`
      );
      console.error(
        `[NOTIFICATIONS] 2. TWILIO_PARCEL_ACCEPTED_TEMPLATE_SID is set in environment variables`
      );
      console.error(
        `[NOTIFICATIONS] 3. Template is approved and active in Twilio Console`
      );

      // Re-throw so caller knows notification failed
      throw error;
    }
  } catch (error) {
    console.error(
      `[NOTIFICATIONS] Error notifying sender of accepted match ${matchId}:`,
      error
    );
    // Don't throw - notification failures shouldn't break the matching process
  }
}

/**
 * Notify sender via WhatsApp when payment is successful (static template, no variables).
 * Uses TWILIO_PAYMENT_SUCCESS_TEMPLATE_SID - template body should be: HXf94651b93b7d3b0b5bb4c5e10d182fba
 */
export async function notifySenderOfPaymentSuccess(
  supabase: SupabaseClient<Database>,
  parcelId: string
): Promise<void> {
  const templateContentId = process.env.TWILIO_PAYMENT_SUCCESS_TEMPLATE_SID;
  if (!templateContentId) {
    console.warn(
      "[NOTIFICATIONS] TWILIO_PAYMENT_SUCCESS_TEMPLATE_SID not set, skipping payment success message"
    );
    return;
  }

  try {
    const { data: parcel, error: parcelError } = await supabase
      .from("parcels")
      .select("id, sender_id")
      .eq("id", parcelId)
      .single();

    if (parcelError || !parcel) {
      console.warn(
        "[NOTIFICATIONS] Parcel not found for payment success:",
        parcelId
      );
      return;
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("whatsapp_number, phone_number")
      .eq("id", parcel.sender_id)
      .single<Pick<Profile, "whatsapp_number" | "phone_number">>();

    const senderWhatsApp =
      senderProfile?.whatsapp_number || senderProfile?.phone_number;
    if (!senderWhatsApp) {
      console.warn(
        "[NOTIFICATIONS] Sender has no WhatsApp/phone for payment success:",
        parcel.sender_id
      );
      return;
    }

    const whatsappClient = createWhatsAppClient();
    await whatsappClient.sendContentTemplate(senderWhatsApp, templateContentId);
    console.log(
      "[NOTIFICATIONS] ✅ Payment success message sent to sender via template",
      templateContentId
    );
  } catch (error: any) {
    console.error(
      "[NOTIFICATIONS] Payment success message failed:",
      error?.message ?? error
    );
    // Don't throw - payment is already recorded
  }
}
