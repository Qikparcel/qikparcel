import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { isBiddingEnabled } from "@/lib/bidding/config";
import { handleBiddingClose } from "@/lib/bidding/close-handler";
import {
  excludeCourierFromParcel,
  recordStrike,
} from "@/lib/bidding/strikes";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];

/**
 * POST /api/bidding/parcels/[id]/withdraw-winner
 *
 * Used when a courier who *won* a bid can no longer fulfil it.
 * Only allowed before payment_status = 'paid'.
 *
 * Effects:
 *  - Match -> rejected, parcel_bids.accepted -> rejected, trip unlocked
 *  - Parcel reverts to pending, pricing_mode briefly stays 'bidding' so the
 *    close-handler routes the fallback cleanly.
 *  - Courier earns a strike + per-parcel exclusion.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isBiddingEnabled()) {
    return NextResponse.json(
      { error: "Bidding is not enabled" },
      { status: 503 }
    );
  }

  try {
    const parcelId = params.id;
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();

    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select("*")
      .eq("id", parcelId)
      .single<Parcel>();
    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    if (!parcel.matched_trip_id || parcel.status !== "matched") {
      return NextResponse.json(
        { error: "Parcel is not in a withdrawable matched state" },
        { status: 400 }
      );
    }

    const { data: match, error: matchError } = await adminClient
      .from("parcel_trip_matches")
      .select("id, parcel_id, trip_id, status, payment_status")
      .eq("parcel_id", parcelId)
      .eq("trip_id", parcel.matched_trip_id)
      .eq("status", "accepted")
      .single<
        Pick<Match, "id" | "parcel_id" | "trip_id" | "status" | "payment_status">
      >();
    if (matchError || !match) {
      return NextResponse.json(
        { error: "Accepted match not found" },
        { status: 404 }
      );
    }

    const { data: trip } = await adminClient
      .from("trips")
      .select("courier_id")
      .eq("id", match.trip_id)
      .single<{ courier_id: string }>();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.courier_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only the winning courier can withdraw" },
        { status: 403 }
      );
    }

    if (match.payment_status === "paid") {
      return NextResponse.json(
        {
          error:
            "Payment already completed; please use the dispute flow instead",
        },
        { status: 400 }
      );
    }

    // Reject match
    await (adminClient.from("parcel_trip_matches") as any)
      .update({ status: "rejected" })
      .eq("id", match.id);

    // Flip the winning bid back to rejected
    await (adminClient.from("parcel_bids") as any)
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("parcel_id", parcelId)
      .eq("courier_id", trip.courier_id)
      .eq("status", "accepted");

    // Unlock trip
    await (adminClient.from("trips") as any)
      .update({
        locked_parcel_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.trip_id);

    // Revert parcel to pending bidding so the close-handler can dispatch fallback
    await (adminClient.from("parcels") as any)
      .update({
        status: "pending",
        matched_trip_id: null,
        pricing_mode: "bidding",
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcelId);

    // Strike + per-parcel exclusion for this courier
    await excludeCourierFromParcel(adminClient, {
      parcelId,
      courierId: trip.courier_id,
      reason: "bid_won_withdrew",
    });
    await recordStrike(adminClient, {
      courierId: trip.courier_id,
      parcelId,
      reason: "bid_won_withdrew",
    });

    const result = await handleBiddingClose(
      adminClient,
      parcelId,
      "winner_withdrew"
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[BIDDING] withdraw-winner error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
