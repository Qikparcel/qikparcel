import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { isBiddingEnabled } from "@/lib/bidding/config";
import {
  assertCourierCanBid,
  isBiddingOpen,
  validateBidAmount,
} from "@/lib/bidding/validators";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Bid = Database["public"]["Tables"]["parcel_bids"]["Row"];

/**
 * GET /api/bidding/parcels/[id]/bids
 * - Sender of the parcel sees all active bids (sealed: hidden from other couriers).
 * - The bidding courier can see their own active bid.
 * - Admin sees all.
 */
export async function GET(
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

    const { data: parcel, error: parcelError } = await supabase
      .from("parcels")
      .select("id, sender_id, pricing_mode")
      .eq("id", parcelId)
      .single<Pick<Parcel, "id" | "sender_id" | "pricing_mode">>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: "sender" | "courier" | "admin" }>();

    const isSender = parcel.sender_id === session.user.id;
    const isAdmin = profile?.role === "admin";
    const isCourier = profile?.role === "courier";

    if (!isSender && !isAdmin && !isCourier) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = createSupabaseAdminClient();
    let query = adminClient
      .from("parcel_bids")
      .select(
        `id, parcel_id, courier_id, trip_id, amount, currency, message,
         estimated_pickup_at, estimated_delivery_at, status,
         created_at, updated_at,
         courier:profiles!parcel_bids_courier_id_fkey(id, full_name, phone_number)`
      )
      .eq("parcel_id", parcelId)
      .order("amount", { ascending: true });

    if (!isSender && !isAdmin) {
      query = query.eq("courier_id", session.user.id);
    }

    const { data: bids, error: bidsError } = await query;
    if (bidsError) {
      return NextResponse.json(
        { error: "Failed to fetch bids", details: bidsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, bids: bids ?? [] });
  } catch (error: any) {
    console.error("[BIDDING] GET bids error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bidding/parcels/[id]/bids
 * Courier submits a new bid (or upserts an existing active bid).
 * Body: { amount: number, currency?: string, message?: string,
 *         trip_id?: string, estimated_pickup_at?: string,
 *         estimated_delivery_at?: string }
 */
export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => ({}));
    const amountRaw = body.amount;
    const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
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

    if (!isBiddingOpen(parcel)) {
      return NextResponse.json(
        { error: "Bidding is not open for this parcel" },
        { status: 400 }
      );
    }

    if (parcel.sender_id === session.user.id) {
      return NextResponse.json(
        { error: "Senders cannot bid on their own parcels" },
        { status: 403 }
      );
    }

    const eligibility = await assertCourierCanBid(
      adminClient,
      session.user.id,
      parcelId
    );
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.error },
        { status: eligibility.status }
      );
    }

    const amountCheck = validateBidAmount(parcel, amount);
    if (!amountCheck.ok) {
      return NextResponse.json({ error: amountCheck.error }, { status: 400 });
    }

    // Optional trip_id must belong to the courier and be schedulable.
    let tripId: string | null = null;
    if (body.trip_id) {
      const { data: trip } = await adminClient
        .from("trips")
        .select("id, courier_id, status, locked_parcel_id")
        .eq("id", body.trip_id)
        .single<{
          id: string;
          courier_id: string;
          status: string;
          locked_parcel_id: string | null;
        }>();
      if (
        !trip ||
        trip.courier_id !== session.user.id ||
        trip.locked_parcel_id ||
        !["scheduled", "in_progress"].includes(trip.status)
      ) {
        return NextResponse.json(
          { error: "Invalid trip_id for this bid" },
          { status: 400 }
        );
      }
      tripId = trip.id;
    }

    const currency =
      typeof body.currency === "string" && body.currency
        ? body.currency
        : parcel.bidding_currency || "USD";

    // Upsert: one active bid per (parcel, courier).
    const upsertPayload = {
      parcel_id: parcelId,
      courier_id: session.user.id,
      trip_id: tripId,
      amount,
      currency,
      message: typeof body.message === "string" ? body.message.slice(0, 500) : null,
      estimated_pickup_at:
        typeof body.estimated_pickup_at === "string" ? body.estimated_pickup_at : null,
      estimated_delivery_at:
        typeof body.estimated_delivery_at === "string"
          ? body.estimated_delivery_at
          : null,
      status: "active" as const,
      updated_at: new Date().toISOString(),
    };

    const { data: bid, error: upsertError } = await (
      adminClient.from("parcel_bids") as any
    )
      .upsert(upsertPayload, { onConflict: "parcel_id,courier_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[BIDDING] Upsert bid error:", upsertError);
      return NextResponse.json(
        { error: "Failed to submit bid", details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, bid: bid as Bid });
  } catch (error: any) {
    console.error("[BIDDING] POST bid error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
