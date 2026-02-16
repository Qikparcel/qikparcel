import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { findAndCreateMatchesForTrip } from "@/lib/matching/service";
import { calculateMatchScore } from "@/lib/matching/scoring";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

const MIN_SCORE_THRESHOLD = parseInt(
  process.env.MATCHING_MIN_SCORE_THRESHOLD || "60",
  10
); // Minimum score threshold: 60%

/**
 * GET /api/trips/[id]
 * Get a specific trip by ID
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

    const tripId = params.id;

    // Get trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single<Trip>();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    // Only courier can view their own trip
    if (profile?.role === "courier" && trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to view this trip" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      trip,
    });
  } catch (error: any) {
    console.error("Error in GET /api/trips/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trips/[id]
 * Update a trip
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

    const tripId = params.id;

    // Get existing trip to verify ownership
    const { data: existingTrip, error: tripError } = await supabase
      .from("trips")
      .select("courier_id, status")
      .eq("id", tripId)
      .single<Pick<Trip, "courier_id" | "status">>();

    if (tripError || !existingTrip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Only courier can update their own trip
    if (existingTrip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update this trip" },
        { status: 403 }
      );
    }

    // Only allow editing if trip is in scheduled state (initial/pending state)
    if (existingTrip.status !== "scheduled") {
      return NextResponse.json(
        { error: "Can only edit trips in scheduled state" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      origin_address,
      origin_latitude,
      origin_longitude,
      destination_address,
      destination_latitude,
      destination_longitude,
      departure_time,
      estimated_arrival,
      available_capacity,
    } = body;

    // Validate required fields
    if (!origin_address || !destination_address) {
      return NextResponse.json(
        { error: "Origin and destination addresses are required" },
        { status: 400 }
      );
    }

    // Validate that both dates are provided (mandatory fields)
    if (!departure_time || !departure_time.trim()) {
      return NextResponse.json(
        { error: "Departure time is required" },
        { status: 400 }
      );
    }

    if (!estimated_arrival || !estimated_arrival.trim()) {
      return NextResponse.json(
        { error: "Estimated arrival is required" },
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

    // Validate that origin and destination addresses are different
    if (areAddressesSame(origin_address, destination_address)) {
      return NextResponse.json(
        { error: "Origin and destination addresses cannot be the same" },
        { status: 400 }
      );
    }

    // Validate dates are not in the past
    const now = new Date();
    now.setSeconds(0, 0);

    const departureDate = new Date(departure_time);
    if (isNaN(departureDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid departure time format" },
        { status: 400 }
      );
    }
    if (departureDate.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: "Departure time cannot be in the past" },
        { status: 400 }
      );
    }

    const arrivalDate = new Date(estimated_arrival);
    if (isNaN(arrivalDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid estimated arrival time format" },
        { status: 400 }
      );
    }
    if (arrivalDate.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: "Estimated arrival cannot be in the past" },
        { status: 400 }
      );
    }

    // Ensure arrival is after departure
    if (arrivalDate.getTime() <= departureDate.getTime()) {
      return NextResponse.json(
        { error: "Estimated arrival must be after departure time" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: TripUpdate = {
      origin_address,
      origin_latitude: origin_latitude || null,
      origin_longitude: origin_longitude || null,
      destination_address,
      destination_latitude: destination_latitude || null,
      destination_longitude: destination_longitude || null,
      departure_time,
      estimated_arrival,
      available_capacity: available_capacity || null,
      updated_at: new Date().toISOString(),
    };

    // Update trip
    const { data: updatedTrip, error: updateError } = await supabase
      .from("trips")
      // @ts-expect-error - Supabase update method type inference issue
      .update(updateData)
      .eq("id", tripId)
      .select()
      .single<Trip>();

    if (updateError) {
      console.error("Error updating trip:", updateError);
      return NextResponse.json(
        { error: "Failed to update trip", details: updateError.message },
        { status: 500 }
      );
    }

    // If trip was updated, invalidate existing matches
    // Only if trip is still in 'scheduled' status
    if (existingTrip.status === "scheduled") {
      const adminClient = createSupabaseAdminClient();

      // Invalidate existing pending matches (delete them so they can be re-created with new scores)
      const { error: deleteMatchesError } = await adminClient
        .from("parcel_trip_matches")
        .delete()
        .eq("trip_id", tripId)
        .eq("status", "pending");

      if (deleteMatchesError) {
        console.error(
          `[TRIP UPDATE] Error deleting pending matches:`,
          deleteMatchesError
        );
      } else {
        console.log(
          `[TRIP UPDATE] Invalidated pending matches for trip ${tripId}`
        );
      }

      // For accepted matches, re-score them to see if they're still valid
      // If score drops below threshold, mark as expired and clear matched_trip_id from parcels
      const { data: acceptedMatches, error: acceptedMatchesError } =
        (await adminClient
          .from("parcel_trip_matches")
          .select("id, parcel_id, parcels(*)")
          .eq("trip_id", tripId)
          .eq("status", "accepted")) as {
          data: Array<{
            id: string;
            parcel_id: string;
            parcels: Parcel;
          }> | null;
          error: any;
        };

      if (acceptedMatchesError) {
        console.error(
          `[TRIP UPDATE] Error fetching accepted matches:`,
          acceptedMatchesError
        );
      } else if (acceptedMatches && acceptedMatches.length > 0) {
        console.log(
          `[TRIP UPDATE] Re-scoring ${acceptedMatches.length} accepted matches`
        );

        for (const match of acceptedMatches) {
          const parcel = match.parcels;
          if (!parcel) {
            console.warn(
              `[TRIP UPDATE] Match ${match.id} has no associated parcel, skipping`
            );
            continue;
          }

          const newScore = calculateMatchScore(parcel, updatedTrip);
          console.log(
            `[TRIP UPDATE] Match ${match.id} new score: ${newScore} (threshold: ${MIN_SCORE_THRESHOLD})`
          );

          // If score drops below threshold, expire the match
          if (newScore < MIN_SCORE_THRESHOLD) {
            console.log(
              `[TRIP UPDATE] Expiring accepted match ${match.id} - score dropped to ${newScore}`
            );
            await (adminClient.from("parcel_trip_matches") as any)
              .update({ status: "expired" })
              .eq("id", match.id);

            // Clear matched_trip_id from the parcel if this trip was matched
            if (parcel.matched_trip_id === tripId) {
              await (adminClient.from("parcels") as any)
                .update({ matched_trip_id: null })
                .eq("id", parcel.id);
              console.log(
                `[TRIP UPDATE] Cleared matched_trip_id from parcel ${parcel.id}`
              );
            }
          } else {
            // Update the match score even if still valid
            await (adminClient.from("parcel_trip_matches") as any)
              .update({ match_score: newScore })
              .eq("id", match.id);
            console.log(
              `[TRIP UPDATE] Updated match ${match.id} score to ${newScore}`
            );
          }
        }
      }
    }

    // Trigger matching after trip update (async, don't block response)
    console.log(
      `[TRIP UPDATE] Triggering matching for updated trip: ${tripId}`
    );
    const adminClient = createSupabaseAdminClient();
    findAndCreateMatchesForTrip(adminClient, tripId)
      .then((result) => {
        console.log(
          `[TRIP UPDATE] ✅ Matching completed for trip ${tripId}: ${result.created} matches created`
        );
      })
      .catch((error) => {
        console.error(
          `[TRIP UPDATE] ❌ Error triggering matching for trip ${tripId}:`,
          error
        );
      });

    return NextResponse.json({
      success: true,
      trip: updatedTrip,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/trips/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/[id]
 * Delete a trip. Only allowed for courier when trip is scheduled and has no accepted match.
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

    const tripId = params.id;

    type TripWithLocked = Pick<Trip, "id" | "status" | "courier_id"> & {
      locked_parcel_id?: string | null;
    };
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, status, courier_id, locked_parcel_id")
      .eq("id", tripId)
      .single<TripWithLocked>();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own trips" },
        { status: 403 }
      );
    }

    if (trip.status !== "scheduled") {
      return NextResponse.json(
        {
          error:
            "Only scheduled (pending) trips can be deleted. Trips in progress or completed cannot be deleted.",
        },
        { status: 400 }
      );
    }

    if (trip.locked_parcel_id) {
      return NextResponse.json(
        { error: "Trip has an accepted parcel and cannot be deleted" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data: acceptedMatch } = await adminClient
      .from("parcel_trip_matches")
      .select("id")
      .eq("trip_id", tripId)
      .eq("status", "accepted")
      .limit(1)
      .maybeSingle();

    if (acceptedMatch) {
      return NextResponse.json(
        { error: "Trip has an accepted match and cannot be deleted" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await (adminClient.from("trips") as any)
      .delete()
      .eq("id", tripId);

    if (deleteError) {
      console.error("[TRIP DELETE] Error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete trip", details: deleteError.message },
        { status: 500 }
      );
    }    return NextResponse.json({ success: true, message: "Trip deleted" });
  } catch (error: any) {
    console.error("Error in DELETE /api/trips/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
