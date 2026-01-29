import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { findAndCreateMatchesForTrip } from "@/lib/matching/service";
import { checkCreateRateLimit } from "@/lib/rate-limit";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];

/**
 * Normalize address string for comparison
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s,]/g, ""); // Remove special characters except commas
}

/**
 * Check if two addresses are the same (normalized comparison)
 */
function areAddressesSame(address1: string, address2: string): boolean {
  return normalizeAddress(address1) === normalizeAddress(address2);
}

/**
 * POST /api/trips
 * Create a new trip route
 */
export async function POST(request: NextRequest) {
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

    // Get user profile to verify role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "courier") {
      return NextResponse.json(
        { error: "Only couriers can create trips" },
        { status: 403 }
      );
    }

    const { allowed: tripLimitAllowed, count: tripCount } = await checkCreateRateLimit(
      supabase,
      "trips",
      "courier_id",
      session.user.id,
      15,
      5
    );
    if (!tripLimitAllowed) {
      return NextResponse.json(
        { error: "Too many trips created. Please wait a few minutes before creating another." },
        { status: 429 }
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

    // Log coordinates for debugging
    console.log('[TRIP API] Received coordinates:', {
      origin: { lat: origin_latitude, lon: origin_longitude },
      destination: { lat: destination_latitude, lon: destination_longitude },
    });

    // Validate required fields
    if (!origin_address || !destination_address) {
      return NextResponse.json(
        { error: "Origin and destination addresses are required" },
        { status: 400 }
      );
    }

    // Validate that origin and destination addresses are different
    if (areAddressesSame(origin_address, destination_address)) {
      return NextResponse.json(
        { error: "Origin and destination addresses cannot be the same" },
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

    // Validate dates are not in the past
    // Dates should already be in UTC ISO strings from the client
    const now = new Date();
    // Reset seconds and milliseconds for comparison
    now.setSeconds(0, 0);

    const departureDate = new Date(departure_time);
    if (isNaN(departureDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid departure time format" },
        { status: 400 }
      );
    }
    // Compare UTC timestamps
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
    // Compare UTC timestamps
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

    // Minimum trip length: 15 minutes (anti-spam / realistic travel time)
    const tripLengthSeconds = (arrivalDate.getTime() - departureDate.getTime()) / 1000;
    const MIN_TRIP_LENGTH_SECONDS = 15 * 60;
    if (tripLengthSeconds < MIN_TRIP_LENGTH_SECONDS) {
      return NextResponse.json(
        { error: "Trip length must be at least 15 minutes. Please set a realistic estimated arrival." },
        { status: 400 }
      );
    }

    // Create trip
    const tripData: TripInsert = {
      courier_id: session.user.id,
      origin_address,
      origin_latitude: origin_latitude || null,
      origin_longitude: origin_longitude || null,
      destination_address,
      destination_latitude: destination_latitude || null,
      destination_longitude: destination_longitude || null,
      departure_time: departure_time, // Required field
      estimated_arrival: estimated_arrival, // Required field
      available_capacity: available_capacity || null,
      status: "scheduled",
    };

    const { data: trip, error: insertError } = await supabase
      .from("trips")
      .insert(tripData as any)
      .select()
      .single<Trip>();

    if (insertError) {
      console.error("Error creating trip:", insertError);
      return NextResponse.json(
        { error: "Failed to create trip", details: insertError.message },
        { status: 500 }
      );
    }

    // Verify coordinates were stored
    console.log('[TRIP API] ✅ Trip created successfully. Coordinates verification:', {
      trip_id: trip.id,
      origin: {
        lat: trip.origin_latitude,
        lon: trip.origin_longitude,
        status: trip.origin_latitude && trip.origin_longitude ? '✅ STORED' : '❌ MISSING'
      },
      destination: {
        lat: trip.destination_latitude,
        lon: trip.destination_longitude,
        status: trip.destination_latitude && trip.destination_longitude ? '✅ STORED' : '❌ MISSING'
      }
    });

    // Trigger automatic matching for this trip
    // Use admin client to bypass RLS and see all parcels
    // Do this asynchronously to not block the response
    console.log(`[TRIP API] Trip created successfully: ${trip.id}, triggering matching...`)
    const adminClient = createSupabaseAdminClient();
    console.log(`[TRIP API] Admin client created, calling findAndCreateMatchesForTrip...`)
    findAndCreateMatchesForTrip(adminClient, trip.id)
      .then((result) => {
        console.log(
          `[TRIP API] ✅ Automatic matching completed for trip ${trip.id}: ${result.created} matches created`
        );
      })
      .catch((error) => {
        console.error(
          `[TRIP API] ❌ Error during automatic matching for trip ${trip.id}:`,
          error
        );
        console.error(`[TRIP API] Error stack:`, error.stack);
        // Don't fail the request if matching fails - matching can be retried
      });

    return NextResponse.json(
      {
        success: true,
        trip,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/trips:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trips
 * Get trips for the authenticated user (courier)
 */
export async function GET(request: NextRequest) {
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

    // Get user profile to verify role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "courier") {
      return NextResponse.json(
        { error: "Only couriers can view their trips" },
        { status: 403 }
      );
    }

    // Get trips for this courier
    const { data: trips, error: tripsError } = await supabase
      .from("trips")
      .select("*")
      .eq("courier_id", session.user.id)
      .order("created_at", { ascending: false });

    if (tripsError) {
      console.error("Error fetching trips:", tripsError);
      return NextResponse.json(
        { error: "Failed to fetch trips", details: tripsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trips: trips || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/trips:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
