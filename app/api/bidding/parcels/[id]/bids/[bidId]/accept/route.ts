import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { isBiddingEnabled, BIDDING_CONFIG } from "@/lib/bidding/config";
import { notifySenderOfAcceptedMatch } from "@/lib/matching/notifications";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Bid = Database["public"]["Tables"]["parcel_bids"]["Row"];
type ParcelStatusHistoryInsert =
  Database["public"]["Tables"]["parcel_status_history"]["Insert"];

/**
 * POST /api/bidding/parcels/[id]/bids/[bidId]/accept
 * Sender picks a winning bid:
 *  - Bid status -> 'accepted', other active bids -> 'rejected'.
 *  - Reuses parcel_trip_matches by inserting/upserting an accepted match,
 *    so the existing payment + status flow keeps working.
 *  - Locks the trip (if bid carried a trip_id), updates parcel status='matched',
 *    payment_status='pending'.
 *  - Sets a soft "payment_due_at" deadline via metadata for the cron handler.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; bidId: string } }
) {
  if (!isBiddingEnabled()) {
    return NextResponse.json(
      { error: "Bidding is not enabled" },
      { status: 503 }
    );
  }

  try {
    const parcelId = params.id;
    const bidId = params.bidId;

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

    if (parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only the sender can accept bids on this parcel" },
        { status: 403 }
      );
    }

    if (parcel.status !== "pending") {
      return NextResponse.json(
        { error: `Parcel is ${parcel.status}, cannot accept bids` },
        { status: 400 }
      );
    }

    if (parcel.pricing_mode !== "bidding") {
      return NextResponse.json(
        { error: "Parcel is not in bidding mode" },
        { status: 400 }
      );
    }

    const { data: bid, error: bidError } = await adminClient
      .from("parcel_bids")
      .select("*")
      .eq("id", bidId)
      .eq("parcel_id", parcelId)
      .single<Bid>();

    if (bidError || !bid) {
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    if (bid.status !== "active") {
      return NextResponse.json(
        { error: `Bid is ${bid.status} and cannot be accepted` },
        { status: 400 }
      );
    }

    const courierId = bid.courier_id;

    // Resolve a trip for the lock. Prefer the bid's trip_id; otherwise pick a
    // suitable scheduled trip from this courier (must be unlocked).
    let tripId: string | null = bid.trip_id;
    if (tripId) {
      const { data: trip } = await adminClient
        .from("trips")
        .select("id, courier_id, status, locked_parcel_id")
        .eq("id", tripId)
        .single<{
          id: string;
          courier_id: string;
          status: string;
          locked_parcel_id: string | null;
        }>();
      if (
        !trip ||
        trip.courier_id !== courierId ||
        trip.locked_parcel_id ||
        !["scheduled", "in_progress"].includes(trip.status)
      ) {
        return NextResponse.json(
          { error: "Bid's trip is no longer available" },
          { status: 400 }
        );
      }
    } else {
      const { data: fallbackTrip } = await adminClient
        .from("trips")
        .select("id, status, locked_parcel_id")
        .eq("courier_id", courierId)
        .in("status", ["scheduled", "in_progress"])
        .is("locked_parcel_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          status: string;
          locked_parcel_id: string | null;
        }>();
      if (!fallbackTrip) {
        return NextResponse.json(
          {
            error:
              "Courier has no available trip to fulfil this bid. Ask them to create a trip first.",
          },
          { status: 400 }
        );
      }
      tripId = fallbackTrip.id;
    }

    const platformFee = round2(
      bid.amount *
        (parseFloat(process.env.PLATFORM_COMMISSION_PERCENT || "15") / 100)
    );
    const totalAmount = round2(bid.amount + platformFee);
    const currency = bid.currency || parcel.bidding_currency || "USD";

    // Upsert match record so the rest of the pipeline (payments, chat gating,
    // status history, notifications) keeps working unchanged.
    const matchPayload = {
      parcel_id: parcelId,
      trip_id: tripId,
      match_score: null,
      status: "accepted" as const,
      accepted_at: new Date().toISOString(),
      delivery_fee: bid.amount,
      platform_fee: platformFee,
      total_amount: totalAmount,
      currency,
      payment_status: "pending" as const,
    };

    const { data: match, error: matchError } = await (
      adminClient.from("parcel_trip_matches") as any
    )
      .upsert(matchPayload, { onConflict: "parcel_id,trip_id" })
      .select()
      .single();

    if (matchError) {
      console.error("[BIDDING] Failed to upsert match:", matchError);
      return NextResponse.json(
        { error: "Failed to create match", details: matchError.message },
        { status: 500 }
      );
    }

    // Mark winning bid + reject siblings, all in one go.
    await (adminClient.from("parcel_bids") as any)
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("parcel_id", parcelId)
      .eq("status", "active")
      .neq("id", bidId);

    await (adminClient.from("parcel_bids") as any)
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", bidId);

    // Lock trip + update parcel
    await (adminClient.from("trips") as any)
      .update({
        locked_parcel_id: parcelId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    await (adminClient.from("parcels") as any)
      .update({
        status: "matched",
        matched_trip_id: tripId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcelId);

    // Status history
    const statusHistoryData: ParcelStatusHistoryInsert = {
      parcel_id: parcelId,
      status: "matched",
      notes: `Bid accepted: ${bid.amount} ${currency} from courier ${courierId}. Payment due within ${BIDDING_CONFIG.paymentWindowHours}h.`,
    };
    await (adminClient.from("parcel_status_history") as any).insert(
      statusHistoryData
    );

    // Reuse existing notification path (sender already gets payment link via this template)
    notifySenderOfAcceptedMatch(adminClient, match.id).catch((err) =>
      console.error("[BIDDING] Notification error:", err)
    );

    return NextResponse.json({
      success: true,
      match: {
        id: match.id,
        parcel_id: parcelId,
        trip_id: tripId,
        delivery_fee: bid.amount,
        platform_fee: platformFee,
        total_amount: totalAmount,
        currency,
        payment_status: "pending",
        payment_due_at: new Date(
          Date.now() + BIDDING_CONFIG.paymentWindowHours * 60 * 60 * 1000
        ).toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[BIDDING] Accept bid error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
