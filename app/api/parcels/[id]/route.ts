import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { findAndCreateMatchesForParcel } from "@/lib/matching/service";
import { calculateMatchScore } from "@/lib/matching/scoring";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type ParcelUpdate = Database["public"]["Tables"]["parcels"]["Update"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];

const MIN_SCORE_THRESHOLD = parseInt(
  process.env.MATCHING_MIN_SCORE_THRESHOLD || "60",
  10
); // Minimum score threshold: 60%

/**
 * GET /api/parcels/[id]
 * Get a specific parcel by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parcelId = params.id;

    // Get user profile first (to check role)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    const isAdmin = profile?.role === "admin";

    // Admin: use admin client to bypass RLS (auth.uid() can be unset in API context)
    // Others: use regular client (RLS allows sender/courier)
    const fetchClient = isAdmin ? createSupabaseAdminClient() : supabase;

    const { data: parcel, error: parcelError } = await fetchClient
      .from("parcels")
      .select("*")
      .eq("id", parcelId)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    // Sender can view their own parcel, courier can view parcels matched to their trips, admin can view any
    if (profile?.role === "admin") {
      // Admin: allow access, we'll attach sender (and optionally courier) info below
    } else if (
      profile?.role === "sender" &&
      parcel.sender_id !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Unauthorized to view this parcel" },
        { status: 403 }
      );
    } else if (profile?.role === "courier") {
      if (!parcel.matched_trip_id) {
        return NextResponse.json(
          { error: "Unauthorized to view this parcel" },
          { status: 403 }
        );
      }
      const { data: trip } = await supabase
        .from("trips")
        .select("courier_id")
        .eq("id", parcel.matched_trip_id)
        .single<Pick<Trip, "courier_id">>();

      if (!trip || trip.courier_id !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to view this parcel" },
          { status: 403 }
        );
      }
    }

    // Get status history (use admin client for admin to bypass RLS)
    const historyClient = isAdmin ? createSupabaseAdminClient() : supabase;
    const { data: statusHistory, error: historyError } = await historyClient
      .from("parcel_status_history")
      .select("*")
      .eq("parcel_id", parcelId)
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching status history:", historyError);
    }

    // When sender views their matched parcel, include courier info and payment details
    // When admin views any parcel, include sender info and (if matched) courier + payment
    let matchedCourier: {
      full_name: string | null;
      phone_number: string;
      whatsapp_number: string | null;
    } | null = null;
    let paymentInfo: {
      total_amount: number;
      currency: string;
      payment_status: string;
      delivery_confirmed_by_sender_at?: string | null;
    } | null = null;
    let senderInfo: {
      full_name: string | null;
      phone_number: string;
      email: string | null;
      id: string;
    } | null = null;

    const adminClient = createSupabaseAdminClient();
    const senderViewingOwnMatched =
      parcel.matched_trip_id &&
      profile?.role === "sender" &&
      parcel.sender_id === session.user.id;

    if (isAdmin && parcel.sender_id) {
      const { data: senderProfile } = await adminClient
        .from("profiles")
        .select("id, full_name, phone_number, email")
        .eq("id", parcel.sender_id)
        .single<Pick<Profile, "id" | "full_name" | "phone_number" | "email">>();
      if (senderProfile) {
        senderInfo = {
          id: senderProfile.id,
          full_name: senderProfile.full_name ?? null,
          phone_number: senderProfile.phone_number,
          email: senderProfile.email ?? null,
        };
      }
    }

    if (parcel.matched_trip_id && (isAdmin || senderViewingOwnMatched)) {
      const { data: match } = await adminClient
        .from("parcel_trip_matches")
        .select(
          "total_amount, currency, payment_status, delivery_confirmed_by_sender_at"
        )
        .eq("parcel_id", parcelId)
        .eq("trip_id", parcel.matched_trip_id)
        .eq("status", "accepted")
        .single<
          Pick<
            Match,
            | "total_amount"
            | "currency"
            | "payment_status"
            | "delivery_confirmed_by_sender_at"
          >
        >();
      if (match?.total_amount != null) {
        paymentInfo = {
          total_amount: Number(match.total_amount),
          currency: match.currency || "USD",
          payment_status: match.payment_status || "pending",
          delivery_confirmed_by_sender_at:
            match.delivery_confirmed_by_sender_at ?? null,
        };
      }
      const { data: trip } = await adminClient
        .from("trips")
        .select("courier_id")
        .eq("id", parcel.matched_trip_id)
        .single<Pick<Trip, "courier_id">>();
      if (trip?.courier_id) {
        const { data: courierProfile } = await adminClient
          .from("profiles")
          .select("full_name, phone_number, whatsapp_number")
          .eq("id", trip.courier_id)
          .single<
            Pick<Profile, "full_name" | "phone_number" | "whatsapp_number">
          >();
        if (courierProfile) {
          matchedCourier = {
            full_name: courierProfile.full_name ?? null,
            phone_number: courierProfile.phone_number,
            whatsapp_number: courierProfile.whatsapp_number ?? null,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      parcel,
      statusHistory: statusHistory || [],
      matchedCourier: matchedCourier ?? undefined,
      paymentInfo: paymentInfo ?? undefined,
      senderInfo: senderInfo ?? undefined,
    });
  } catch (error: any) {
    console.error("Error in GET /api/parcels/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/parcels/[id]
 * Update a parcel
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parcelId = params.id;

    // Get existing parcel to verify ownership and check matched_trip_id
    const { data: existingParcel, error: parcelError } = await supabase
      .from("parcels")
      .select("sender_id, status, matched_trip_id")
      .eq("id", parcelId)
      .single<Pick<Parcel, "sender_id" | "status" | "matched_trip_id">>();

    if (parcelError || !existingParcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    // Only sender can update their own parcel
    if (existingParcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update this parcel" },
        { status: 403 }
      );
    }

    // Only allow editing if parcel is in pending state
    if (existingParcel.status !== "pending") {
      return NextResponse.json(
        { error: "Can only edit parcels in pending state" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      description,
      weight_kg,
      dimensions,
      estimated_value,
      estimated_value_currency,
      preferred_pickup_time,
    } = body;

    // Validate required fields
    if (!pickup_address || !delivery_address) {
      return NextResponse.json(
        { error: "Pickup and delivery addresses are required" },
        { status: 400 }
      );
    }

    // Normalize address for comparison
    const normalizeAddress = (address: string): string => {
      return address
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s,]/g, "");
    };

    const areAddressesSame = (address1: string, address2: string): boolean => {
      return normalizeAddress(address1) === normalizeAddress(address2);
    };

    // Validate that pickup and delivery addresses are different
    if (areAddressesSame(pickup_address, delivery_address)) {
      return NextResponse.json(
        { error: "Pickup and delivery addresses cannot be the same" },
        { status: 400 }
      );
    }

    if (
      dimensions === undefined ||
      dimensions === null ||
      (typeof dimensions === "string" && !dimensions.trim())
    ) {
      return NextResponse.json(
        { error: "Dimensions are required" },
        { status: 400 }
      );
    }

    const MAX_WEIGHT_KG = 10;
    if (weight_kg != null && weight_kg !== "") {
      const w =
        typeof weight_kg === "number" ? weight_kg : parseFloat(weight_kg);
      if (Number.isNaN(w) || w < 0) {
        return NextResponse.json(
          { error: "Weight must be a valid number (0 or more)" },
          { status: 400 }
        );
      }
      if (w > MAX_WEIGHT_KG) {
        return NextResponse.json(
          {
            error: `Maximum package weight is ${MAX_WEIGHT_KG} kg. Please enter ${MAX_WEIGHT_KG} kg or less.`,
          },
          { status: 400 }
        );
      }
    }

    if (estimated_value == null || estimated_value === "") {
      return NextResponse.json(
        { error: "Estimated value is required" },
        { status: 400 }
      );
    }
    const valueNum =
      typeof estimated_value === "number"
        ? estimated_value
        : parseFloat(estimated_value);
    if (Number.isNaN(valueNum) || valueNum < 0) {
      return NextResponse.json(
        { error: "Estimated value must be a valid number (0 or more)" },
        { status: 400 }
      );
    }
    const MAX_ESTIMATED_VALUE = 2000;
    if (valueNum > MAX_ESTIMATED_VALUE) {
      return NextResponse.json(
        {
          error: `Estimated value cannot exceed ${MAX_ESTIMATED_VALUE.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: ParcelUpdate & {
      estimated_value_currency?: string | null;
      preferred_pickup_time?: string | null;
    } = {
      pickup_address,
      pickup_latitude: pickup_latitude || null,
      pickup_longitude: pickup_longitude || null,
      delivery_address,
      delivery_latitude: delivery_latitude || null,
      delivery_longitude: delivery_longitude || null,
      description: description || null,
      weight_kg: weight_kg || null,
      dimensions:
        typeof dimensions === "string" ? dimensions.trim() : dimensions,
      estimated_value: valueNum,
      estimated_value_currency: estimated_value_currency || "USD",
      preferred_pickup_time: preferred_pickup_time || null,
      updated_at: new Date().toISOString(),
    };

    // Update parcel
    const { data: updatedParcel, error: updateError } = await supabase
      .from("parcels")
      // @ts-expect-error - Supabase update method type inference issue
      .update(updateData)
      .eq("id", parcelId)
      .select()
      .single<Parcel>();

    if (updateError) {
      console.error("Error updating parcel:", updateError);
      return NextResponse.json(
        { error: "Failed to update parcel", details: updateError.message },
        { status: 500 }
      );
    }

    // If parcel was matched, invalidate existing matches and clear matched_trip_id
    // Only if parcel is still in 'pending' status (can't change matched/accepted parcels)
    if (existingParcel.status === "pending") {
      const adminClient = createSupabaseAdminClient();

      // Clear matched_trip_id if it was set
      if (existingParcel.matched_trip_id) {
        console.log(
          `[PARCEL UPDATE] Clearing matched_trip_id for parcel ${parcelId} due to update`
        );
        await (adminClient.from("parcels") as any)
          .update({ matched_trip_id: null })
          .eq("id", parcelId);
      }

      // Invalidate existing pending matches (delete them so they can be re-created with new scores)
      const { error: deleteMatchesError } = await adminClient
        .from("parcel_trip_matches")
        .delete()
        .eq("parcel_id", parcelId)
        .eq("status", "pending");

      if (deleteMatchesError) {
        console.error(
          `[PARCEL UPDATE] Error deleting pending matches:`,
          deleteMatchesError
        );
      } else {
        console.log(
          `[PARCEL UPDATE] Invalidated pending matches for parcel ${parcelId}`
        );
      }

      // For accepted matches, re-score them to see if they're still valid
      // If score drops below threshold, mark as expired
      const { data: acceptedMatches, error: acceptedMatchesError } =
        (await adminClient
          .from("parcel_trip_matches")
          .select("id, trip_id, trips(*)")
          .eq("parcel_id", parcelId)
          .eq("status", "accepted")) as {
          data: Array<{ id: string; trip_id: string; trips: Trip }> | null;
          error: any;
        };

      if (acceptedMatchesError) {
        console.error(
          `[PARCEL UPDATE] Error fetching accepted matches:`,
          acceptedMatchesError
        );
      } else if (acceptedMatches && acceptedMatches.length > 0) {
        console.log(
          `[PARCEL UPDATE] Re-scoring ${acceptedMatches.length} accepted matches`
        );

        for (const match of acceptedMatches) {
          const trip = match.trips;
          if (!trip) {
            console.warn(
              `[PARCEL UPDATE] Match ${match.id} has no associated trip, skipping`
            );
            continue;
          }

          const newScore = calculateMatchScore(updatedParcel, trip);
          console.log(
            `[PARCEL UPDATE] Match ${match.id} new score: ${newScore} (threshold: ${MIN_SCORE_THRESHOLD})`
          );

          // If score drops below threshold, expire the match
          if (newScore < MIN_SCORE_THRESHOLD) {
            console.log(
              `[PARCEL UPDATE] Expiring accepted match ${match.id} - score dropped to ${newScore}`
            );
            await (adminClient.from("parcel_trip_matches") as any)
              .update({ status: "expired" })
              .eq("id", match.id);

            // Clear matched_trip_id if this was the matched trip
            if (updatedParcel.matched_trip_id === trip.id) {
              await (adminClient.from("parcels") as any)
                .update({ matched_trip_id: null })
                .eq("id", parcelId);
            }
          } else {
            // Update the match score even if still valid
            await (adminClient.from("parcel_trip_matches") as any)
              .update({ match_score: newScore })
              .eq("id", match.id);
            console.log(
              `[PARCEL UPDATE] Updated match ${match.id} score to ${newScore}`
            );
          }
        }
      }
    }

    // Trigger matching after parcel update (async, don't block response)
    console.log(
      `[PARCEL UPDATE] Triggering matching for updated parcel: ${parcelId}`
    );
    const adminClient = createSupabaseAdminClient();
    findAndCreateMatchesForParcel(adminClient, parcelId)
      .then((result) => {
        console.log(
          `[PARCEL UPDATE] ✅ Matching completed for parcel ${parcelId}: ${result.created} matches created`
        );
      })
      .catch((error) => {
        console.error(
          `[PARCEL UPDATE] ❌ Error triggering matching for parcel ${parcelId}:`,
          error
        );
      });

    return NextResponse.json({
      success: true,
      parcel: updatedParcel,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/parcels/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parcels/[id]
 * Delete a parcel. Only allowed for sender when parcel is pending (not matched).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parcelId = params.id;

    const { data: parcel, error: parcelError } = await supabase
      .from("parcels")
      .select("id, status, sender_id, matched_trip_id")
      .eq("id", parcelId)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    if (parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own parcels" },
        { status: 403 }
      );
    }

    if (parcel.status !== "pending") {
      return NextResponse.json(
        {
          error:
            "Only pending (unmatched) parcels can be deleted. Cancel or contact support for matched parcels.",
        },
        { status: 400 }
      );
    }

    if (parcel.matched_trip_id) {
      return NextResponse.json(
        { error: "Parcel is matched and cannot be deleted" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error: deleteError } = await (adminClient.from("parcels") as any)
      .delete()
      .eq("id", parcelId);

    if (deleteError) {
      console.error("[PARCEL DELETE] Error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete parcel", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Parcel deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /api/parcels/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
