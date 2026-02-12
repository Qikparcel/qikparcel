import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { calculateDeliveryPricing } from "@/lib/pricing";

/**
 * GET /api/pricing/estimate
 * Query: pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_country, delivery_country, weight_kg (optional)
 * Returns estimated delivery fee, platform fee, and total for sender display when creating a parcel.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pickupLat = searchParams.get("pickup_lat");
    const pickupLng = searchParams.get("pickup_lng");
    const deliveryLat = searchParams.get("delivery_lat");
    const deliveryLng = searchParams.get("delivery_lng");
    const pickupCountry = searchParams.get("pickup_country") || null;
    const deliveryCountry = searchParams.get("delivery_country") || null;
    const weightKg = searchParams.get("weight_kg");

    if (
      pickupLat == null ||
      pickupLng == null ||
      deliveryLat == null ||
      deliveryLng == null
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required params: pickup_lat, pickup_lng, delivery_lat, delivery_lng",
        },
        { status: 400 }
      );
    }

    const lat1 = parseFloat(pickupLat);
    const lng1 = parseFloat(pickupLng);
    const lat2 = parseFloat(deliveryLat);
    const lng2 = parseFloat(deliveryLng);

    if (
      Number.isNaN(lat1) ||
      Number.isNaN(lng1) ||
      Number.isNaN(lat2) ||
      Number.isNaN(lng2)
    ) {
      return NextResponse.json(
        { error: "Invalid latitude/longitude values" },
        { status: 400 }
      );
    }

    const weight =
      weightKg != null && weightKg !== "" ? parseFloat(weightKg) : null;
    const parcelSize =
      weight != null && weight <= 2
        ? ("small" as const)
        : weight != null && weight <= 10
        ? ("medium" as const)
        : ("large" as const);

    const supabase = createSupabaseAdminClient();
    const pricing = await calculateDeliveryPricing(supabase, {
      pickupLat: lat1,
      pickupLng: lng1,
      deliveryLat: lat2,
      deliveryLng: lng2,
      pickupCountry: pickupCountry?.trim() || null,
      deliveryCountry: deliveryCountry?.trim() || null,
      parcelSize,
    });

    if (!pricing) {
      return NextResponse.json(
        { error: "No pricing available for this route" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      delivery_fee: pricing.deliveryFee,
      platform_fee: pricing.platformFee,
      total_amount: pricing.totalAmount,
      currency: pricing.currency,
      is_domestic: pricing.isDomestic,
      distance_km: pricing.distanceKm,
    });
  } catch (error: any) {
    console.error("[PRICING] Estimate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get estimate" },
      { status: 500 }
    );
  }
}
