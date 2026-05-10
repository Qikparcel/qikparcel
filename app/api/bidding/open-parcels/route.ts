import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { isBiddingEnabled } from "@/lib/bidding/config";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

/**
 * GET /api/bidding/open-parcels
 *
 * Returns parcels currently open for bidding, plus the calling courier's
 * own active bid on each (if any). The bid *amounts* of other couriers are
 * intentionally not returned here (sealed auction).
 *
 * Excludes parcels where the courier is on the per-parcel exclusion list or
 * is suspended via strikes (those checks are handled by assertCourierCanBid
 * and by the finder; here we do a lightweight row-level filter).
 */
export async function GET(_request: NextRequest) {
  if (!isBiddingEnabled()) {
    return NextResponse.json(
      { error: "Bidding is not enabled" },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courierId = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", courierId)
      .single<{ role: "sender" | "courier" | "admin" }>();

    if (!profile || profile.role !== "courier") {
      return NextResponse.json(
        { error: "Only couriers can view the bidding feed" },
        { status: 403 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // Open bidding parcels the courier is not excluded from
    const { data: parcels, error: parcelsError } = await adminClient
      .from("parcels")
      .select(
        `id, pickup_address, pickup_latitude, pickup_longitude,
         pickup_country, delivery_address, delivery_latitude,
         delivery_longitude, delivery_country, description,
         weight_kg, dimensions, status,
         pricing_mode, bidding_closes_at, bidding_opens_at,
         bidding_estimate_amount, bidding_min_amount,
         bidding_max_amount, bidding_currency, created_at`
      )
      .eq("status", "pending")
      .eq("pricing_mode", "bidding")
      .gt("bidding_closes_at", nowIso)
      .order("bidding_closes_at", { ascending: true })
      .limit(100);

    if (parcelsError) {
      return NextResponse.json(
        { error: "Failed to load parcels", details: parcelsError.message },
        { status: 500 }
      );
    }

    if (!parcels || parcels.length === 0) {
      return NextResponse.json({ success: true, parcels: [] });
    }

    const parcelIds = parcels.map((p: { id: string }) => p.id);

    // Fetch exclusions for this courier so we can filter out ineligible parcels
    const { data: exclusions } = await adminClient
      .from("parcel_courier_exclusions")
      .select("parcel_id")
      .eq("courier_id", courierId)
      .in("parcel_id", parcelIds);

    const excludedParcelIds = new Set(
      (exclusions ?? []).map((e: { parcel_id: string }) => e.parcel_id)
    );

    // Fetch this courier's own active bids across these parcels
    const { data: myBids } = await adminClient
      .from("parcel_bids")
      .select("id, parcel_id, amount, currency, message, status")
      .eq("courier_id", courierId)
      .eq("status", "active")
      .in("parcel_id", parcelIds);

    const myBidMap = new Map(
      (myBids ?? []).map((b: { parcel_id: string; id: string; amount: number; currency: string; message: string | null; status: string }) => [b.parcel_id, b])
    );

    const result = (parcels as Array<Parcel & Record<string, unknown>>)
      .filter((p) => !excludedParcelIds.has(p.id))
      .map((p) => ({
        ...p,
        my_bid: myBidMap.get(p.id) ?? null,
      }));

    return NextResponse.json({ success: true, parcels: result });
  } catch (error: any) {
    console.error("[BIDDING] open-parcels error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
