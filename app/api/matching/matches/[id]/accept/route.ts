import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { notifySenderOfAcceptedMatch } from "@/lib/matching/notifications";
import { calculateDeliveryPricing } from "@/lib/pricing";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type ParcelStatusHistoryInsert =
  Database["public"]["Tables"]["parcel_status_history"]["Insert"];

/**
 * POST /api/matching/matches/[id]/accept
 * Courier accepts a match
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    const supabase = createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the match first
    const { data: match, error: matchError } = await supabase
      .from("parcel_trip_matches")
      .select(
        "*, trip:trips!parcel_trip_matches_trip_id_fkey(id, courier_id, status)"
      )
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const matchData = match as any;
    const trip = matchData.trip as Trip;
    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found for this match" },
        { status: 404 }
      );
    }

    // Verify user is the courier of this trip
    if (trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: Only the trip courier can accept matches" },
        { status: 403 }
      );
    }

    // Verify match is still pending
    if ((match as Match).status !== "pending") {
      return NextResponse.json(
        { error: "Match is not pending (already accepted or rejected)" },
        { status: 400 }
      );
    }

    // Fetch parcel separately using admin client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get parcel details (with coords and countries for pricing)
    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select(
        "id, status, sender_id, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, pickup_country, delivery_country, weight_kg"
      )
      .eq("id", (match as Match).parcel_id)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    // Verify parcel is still pending
    if (parcel.status !== "pending") {
      return NextResponse.json(
        {
          error: "Parcel is no longer available (already matched or cancelled)",
        },
        { status: 400 }
      );
    }

    // Calculate delivery pricing (domestic vs international) using parcel pickup -> delivery
    const parcelData = parcel as Parcel & {
      pickup_country?: string;
      delivery_country?: string;
      weight_kg?: number;
    };
    let deliveryFee: number | null = null;
    let platformFee: number | null = null;
    let totalAmount: number | null = null;
    const currency = "USD";

    const pricingInput = {
      pickupLat: parcel.pickup_latitude,
      pickupLng: parcel.pickup_longitude,
      deliveryLat: parcel.delivery_latitude,
      deliveryLng: parcel.delivery_longitude,
      pickupCountry: parcelData.pickup_country ?? null,
      deliveryCountry: parcelData.delivery_country ?? null,
      parcelSize:
        parcelData.weight_kg != null && parcelData.weight_kg <= 2
          ? ("small" as const)
          : parcelData.weight_kg != null && parcelData.weight_kg <= 10
          ? ("medium" as const)
          : ("large" as const),
    };
    const pricing = await calculateDeliveryPricing(adminClient, pricingInput);
    if (pricing) {
      deliveryFee = pricing.deliveryFee;
      platformFee = pricing.platformFee;
      totalAmount = pricing.totalAmount;
    }

    // Check if trip is already locked (has another parcel)
    const { data: tripCheck, error: tripCheckError } = await adminClient
      .from("trips")
      .select("id, locked_parcel_id")
      .eq("id", trip.id)
      .single();

    if (tripCheckError || !tripCheck) {
      return NextResponse.json(
        { error: "Failed to verify trip status" },
        { status: 500 }
      );
    }

    // If trip is already locked to a different parcel, reject
    const tripCheckTyped = tripCheck as {
      id: string;
      locked_parcel_id: string | null;
    };
    if (
      tripCheckTyped.locked_parcel_id &&
      tripCheckTyped.locked_parcel_id !== parcel.id
    ) {
      return NextResponse.json(
        { error: "This trip is already locked to another parcel" },
        { status: 400 }
      );
    }

    // 1. Reject all other pending matches for this parcel (first come first served)
    const { error: rejectOtherMatchesError } = await (
      adminClient.from("parcel_trip_matches") as any
    )
      .update({
        status: "rejected",
      })
      .eq("parcel_id", parcel.id)
      .eq("status", "pending")
      .neq("id", matchId);

    if (rejectOtherMatchesError) {
      console.error("Error rejecting other matches:", rejectOtherMatchesError);
      // Continue anyway - this is not critical
    } else {
      console.log(
        `[MATCHING] Rejected other pending matches for parcel ${parcel.id}`
      );
    }

    // 2. Reject all other pending matches for this trip (one parcel per trip)
    const { error: rejectTripMatchesError } = await (
      adminClient.from("parcel_trip_matches") as any
    )
      .update({
        status: "rejected",
      })
      .eq("trip_id", trip.id)
      .eq("status", "pending")
      .neq("id", matchId);

    if (rejectTripMatchesError) {
      console.error(
        "Error rejecting other trip matches:",
        rejectTripMatchesError
      );
      // Continue anyway - this is not critical
    } else {
      console.log(
        `[MATCHING] Rejected other pending matches for trip ${trip.id}`
      );
    }

    // 3. Update match status to accepted and store pricing
    const { error: updateMatchError } = await (
      adminClient.from("parcel_trip_matches") as any
    )
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        delivery_fee: deliveryFee,
        platform_fee: platformFee,
        total_amount: totalAmount,
        currency,
        payment_status: totalAmount != null ? "pending" : null,
      })
      .eq("id", matchId);

    if (updateMatchError) {
      console.error("Error updating match status:", updateMatchError);
      return NextResponse.json(
        { error: "Failed to accept match", details: updateMatchError.message },
        { status: 500 }
      );
    }

    // 4. Update parcel status to matched and set matched_trip_id
    const { error: updateParcelError } = await (
      adminClient.from("parcels") as any
    )
      .update({
        status: "matched",
        matched_trip_id: trip.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcel.id);

    if (updateParcelError) {
      console.error("Error updating parcel status:", updateParcelError);
      return NextResponse.json(
        {
          error: "Failed to update parcel status",
          details: updateParcelError.message,
        },
        { status: 500 }
      );
    }

    // 5. Lock the trip to this parcel (one parcel per trip)
    const { error: lockTripError } = await (adminClient.from("trips") as any)
      .update({
        locked_parcel_id: parcel.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", trip.id);

    if (lockTripError) {
      console.error("Error locking trip:", lockTripError);
      // Log but don't fail - this is important but not critical for the accept flow
    } else {
      console.log(`[MATCHING] Locked trip ${trip.id} to parcel ${parcel.id}`);
    }

    // Create status history entry
    const statusHistoryData: ParcelStatusHistoryInsert = {
      parcel_id: parcel.id,
      status: "matched",
      notes: `Matched with trip ${trip.id}. Courier accepted the match.`,
    };

    await adminClient
      .from("parcel_status_history")
      .insert(statusHistoryData as any);

    // Get sender profile for notification
    const { data: senderProfile } = await adminClient
      .from("profiles")
      .select("whatsapp_number, full_name, phone_number")
      .eq("id", parcel.sender_id)
      .single<
        Pick<Profile, "whatsapp_number" | "full_name" | "phone_number">
      >();

    // Get courier profile for notification
    const { data: courierProfile } = await adminClient
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", trip.courier_id)
      .single<Pick<Profile, "full_name" | "phone_number">>();

    // Send notification to sender (async, don't block response)
    notifySenderOfAcceptedMatch(adminClient, matchId).catch((error) => {
      console.error("[MATCHING] Error sending notification:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Match accepted successfully",
      match: {
        id: matchId,
        status: "accepted",
        parcel_id: parcel.id,
        trip_id: trip.id,
        delivery_fee: deliveryFee,
        platform_fee: platformFee,
        total_amount: totalAmount,
        currency,
        payment_status: totalAmount != null ? "pending" : null,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/matching/matches/[id]/accept:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
