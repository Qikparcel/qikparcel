import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { findAndCreateMatchesForParcel } from "@/lib/matching/service";
import { checkCreateRateLimit } from "@/lib/rate-limit";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type ParcelInsert = Database["public"]["Tables"]["parcels"]["Insert"];
type ParcelStatusHistoryInsert =
  Database["public"]["Tables"]["parcel_status_history"]["Insert"];

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
 * POST /api/parcels
 * Create a new parcel request
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

    if (profile.role !== "sender") {
      return NextResponse.json(
        { error: "Only senders can create parcels" },
        { status: 403 }
      );
    }

    const { allowed: parcelLimitAllowed } = await checkCreateRateLimit(
      supabase,
      "parcels",
      "sender_id",
      session.user.id,
      15,
      5
    );
    if (!parcelLimitAllowed) {
      return NextResponse.json(
        {
          error:
            "Too many parcels created. Please wait a few minutes before creating another.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      pickup_country,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      delivery_country,
      description,
      weight_kg,
      dimensions,
      estimated_value,
      estimated_value_currency,
      preferred_pickup_time,
    } = body;

    // Log coordinates for debugging
    console.log("[PARCEL API] Received coordinates:", {
      pickup: { lat: pickup_latitude, lon: pickup_longitude },
      delivery: { lat: delivery_latitude, lon: delivery_longitude },
    });

    // Validate required fields
    if (!pickup_address || !delivery_address) {
      return NextResponse.json(
        { error: "Pickup and delivery addresses are required" },
        { status: 400 }
      );
    }

    // Validate that pickup and delivery addresses are different
    if (areAddressesSame(pickup_address, delivery_address)) {
      return NextResponse.json(
        { error: "Pickup and delivery addresses cannot be the same" },
        { status: 400 }
      );
    }

    if (!dimensions || typeof dimensions !== "string" || !dimensions.trim()) {
      return NextResponse.json(
        { error: "Dimensions are required" },
        { status: 400 }
      );
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

    // Create parcel
    const parcelData: ParcelInsert = {
      sender_id: session.user.id,
      pickup_address,
      pickup_latitude: pickup_latitude || null,
      pickup_longitude: pickup_longitude || null,
      pickup_country: pickup_country || null,
      delivery_address,
      delivery_latitude: delivery_latitude || null,
      delivery_longitude: delivery_longitude || null,
      delivery_country: delivery_country || null,
      description: description || null,
      weight_kg: weight_kg || null,
      dimensions: dimensions.trim(),
      estimated_value: valueNum,
      estimated_value_currency: estimated_value_currency || "USD",
      preferred_pickup_time: preferred_pickup_time || null,
      status: "pending",
    } as any;

    const { data: parcel, error: insertError } = await supabase
      .from("parcels")
      .insert(parcelData as any)
      .select()
      .single<Parcel>();

    if (insertError) {
      console.error("Error creating parcel:", insertError);
      return NextResponse.json(
        { error: "Failed to create parcel", details: insertError.message },
        { status: 500 }
      );
    }

    // Verify coordinates were stored
    console.log(
      "[PARCEL API] ✅ Parcel created successfully. Coordinates verification:",
      {
        parcel_id: parcel.id,
        pickup: {
          lat: parcel.pickup_latitude,
          lon: parcel.pickup_longitude,
          status:
            parcel.pickup_latitude && parcel.pickup_longitude
              ? "✅ STORED"
              : "❌ MISSING",
        },
        delivery: {
          lat: parcel.delivery_latitude,
          lon: parcel.delivery_longitude,
          status:
            parcel.delivery_latitude && parcel.delivery_longitude
              ? "✅ STORED"
              : "❌ MISSING",
        },
      }
    );

    // Create initial status history entry
    const statusHistoryData: ParcelStatusHistoryInsert = {
      parcel_id: parcel.id,
      status: "pending",
      notes: "Parcel request created",
    };

    await supabase
      .from("parcel_status_history")
      .insert(statusHistoryData as any);

    // Trigger automatic matching for this parcel
    // Use admin client to bypass RLS and see all trips
    // Do this asynchronously to not block the response
    const adminClient = createSupabaseAdminClient();
    findAndCreateMatchesForParcel(adminClient, parcel.id)
      .then((result) => {
        console.log(
          `[MATCHING] Automatic matching completed for parcel ${parcel.id}: ${result.created} matches created`
        );
      })
      .catch((error) => {
        console.error(
          `[MATCHING] Error during automatic matching for parcel ${parcel.id}:`,
          error
        );
        // Don't fail the request if matching fails - matching can be retried
      });

    return NextResponse.json(
      {
        success: true,
        parcel,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/parcels:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/parcels
 * Get parcels for the authenticated user (sender)
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

    if (profile.role !== "sender") {
      return NextResponse.json(
        { error: "Only senders can view their parcels" },
        { status: 403 }
      );
    }

    // Get parcels for this sender
    const { data: parcels, error: parcelsError } = await supabase
      .from("parcels")
      .select("*")
      .eq("sender_id", session.user.id)
      .order("created_at", { ascending: false });

    if (parcelsError) {
      console.error("Error fetching parcels:", parcelsError);
      return NextResponse.json(
        { error: "Failed to fetch parcels", details: parcelsError.message },
        { status: 500 }
      );
    }

    const rawParcels = parcels || [];

    // Enrich matched parcels with courier name for chat/sender view
    const matchedIds = rawParcels
      .filter((p: { matched_trip_id?: string | null }) => p.matched_trip_id)
      .map((p: { matched_trip_id: string }) => p.matched_trip_id);
    const courierMap = new Map<string, string>();

    if (matchedIds.length > 0) {
      const adminClient = createSupabaseAdminClient();
      const { data: trips } = await adminClient
        .from("trips")
        .select("id, courier_id")
        .in("id", matchedIds);
      const courierIds = (trips || [])
        .map((t: { courier_id: string }) => t.courier_id)
        .filter(Boolean);
      if (courierIds.length > 0) {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, full_name")
          .in("id", courierIds);
        (profiles || []).forEach(
          (p: { id: string; full_name: string | null }) => {
            courierMap.set(p.id, p.full_name || "Courier");
          }
        );
      }
      const tripCourierMap = new Map<string, string>();
      (trips || []).forEach((t: { id: string; courier_id: string }) => {
        const name = courierMap.get(t.courier_id);
        if (name) tripCourierMap.set(t.id, name);
      });
      rawParcels.forEach((p: Record<string, unknown>) => {
        const tid = p.matched_trip_id as string | undefined;
        if (tid)
          (p as Record<string, unknown>).courier = {
            full_name: tripCourierMap.get(tid) || "Courier",
          };
      });
    }

    return NextResponse.json({
      success: true,
      parcels: rawParcels,
    });
  } catch (error: any) {
    console.error("Error in GET /api/parcels:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
