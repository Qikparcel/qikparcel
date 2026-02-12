import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";
import { calculateDeliveryPricing } from "@/lib/pricing";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];

/**
 * GET /api/matching/trips/[id]/matches
 * Get all matches for a specific trip
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tripId = params.id;
    const supabase = createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to view this trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("courier_id")
      .eq("id", tripId)
      .single<Pick<Trip, "courier_id">>();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only courier of trip or admin can view matches
    if (profile.role !== "admin" && trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: Cannot view matches for this trip" },
        { status: 403 }
      );
    }

    // Get matches for this trip with parcel details
    // First, get the matches
    const { data: matches, error: matchesError } = await supabase
      .from("parcel_trip_matches")
      .select("*")
      .eq("trip_id", tripId)
      .in("status", ["pending", "accepted", "rejected"])
      .order("match_score", { ascending: false })
      .returns<Match[]>();

    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      return NextResponse.json(
        { error: "Failed to fetch matches", details: matchesError.message },
        { status: 500 }
      );
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        success: true,
        matches: [],
      });
    }

    // Fetch parcel details separately to avoid RLS issues
    // Use admin client if available, otherwise use regular client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let parcelClient = supabase;
    if (supabaseUrl && supabaseServiceKey) {
      // Use admin client to bypass RLS for parcel data
      const { createClient: createAdminClient } = await import(
        "@supabase/supabase-js"
      );
      parcelClient = createAdminClient<Database>(
        supabaseUrl,
        supabaseServiceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }

    // Fetch parcels for all matches (include coords/countries for pricing)
    const parcelIds = matches.map((m) => m.parcel_id);
    const { data: parcels, error: parcelsError } = await parcelClient
      .from("parcels")
      .select(
        `
        id,
        sender_id,
        pickup_address,
        delivery_address,
        description,
        weight_kg,
        dimensions,
        status,
        pickup_latitude,
        pickup_longitude,
        delivery_latitude,
        delivery_longitude,
        pickup_country,
        delivery_country,
        sender:profiles!parcels_sender_id_fkey(
          id,
          full_name,
          phone_number,
          whatsapp_number
        )
      `
      )
      .in("id", parcelIds);

    if (parcelsError) {
      console.error("Error fetching parcels:", parcelsError);
      // Continue without parcel data rather than failing completely
    }

    // Create a map of parcel_id -> parcel for quick lookup
    const parcelMap = new Map();
    if (parcels) {
      parcels.forEach((parcel: any) => {
        parcelMap.set(parcel.id, parcel);
      });
    }

    // Add estimated pricing for courier: for pending use calculated estimate; for accepted use stored values
    const adminClient =
      supabaseUrl && supabaseServiceKey ? (parcelClient as any) : null;

    const processedMatches = await Promise.all(
      matches.map(async (match: any) => {
        const parcel = parcelMap.get(match.parcel_id);
        let estimated_delivery_fee: number | null = null;
        let estimated_total_amount: number | null = null;
        let estimated_currency: string | null = null;

        if (match.status === "accepted" && match.delivery_fee != null) {
          estimated_delivery_fee = Number(match.delivery_fee);
          estimated_total_amount =
            match.total_amount != null ? Number(match.total_amount) : null;
          estimated_currency = match.currency || "USD";
        } else if (
          parcel &&
          adminClient &&
          parcel.pickup_latitude != null &&
          parcel.pickup_longitude != null &&
          parcel.delivery_latitude != null &&
          parcel.delivery_longitude != null
        ) {
          const weight = parcel.weight_kg;
          const parcelSize =
            weight != null && weight <= 2
              ? ("small" as const)
              : weight != null && weight <= 10
              ? ("medium" as const)
              : ("large" as const);
          const pricing = await calculateDeliveryPricing(adminClient, {
            pickupLat: parcel.pickup_latitude,
            pickupLng: parcel.pickup_longitude,
            deliveryLat: parcel.delivery_latitude,
            deliveryLng: parcel.delivery_longitude,
            pickupCountry: parcel.pickup_country ?? null,
            deliveryCountry: parcel.delivery_country ?? null,
            parcelSize,
          });
          if (pricing) {
            estimated_delivery_fee = pricing.deliveryFee;
            estimated_total_amount = pricing.totalAmount;
            estimated_currency = pricing.currency;
          }
        }

        return {
          ...match,
          parcel: parcel || null,
          estimated_delivery_fee,
          estimated_total_amount,
          estimated_currency,
        };
      })
    );

    return NextResponse.json({
      success: true,
      matches: processedMatches,
    });
  } catch (error: any) {
    console.error("Error in GET /api/matching/trips/[id]/matches:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
