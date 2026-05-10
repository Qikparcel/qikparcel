import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { isBiddingEnabled } from "@/lib/bidding/config";

type Bid = Database["public"]["Tables"]["parcel_bids"]["Row"];

/**
 * DELETE /api/bidding/parcels/[id]/bids/[bidId]
 * Courier withdraws their own active bid (only allowed while bidding is open
 * AND no winner has been picked yet).
 */
export async function DELETE(
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
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();

    const { data: bid, error: bidError } = await adminClient
      .from("parcel_bids")
      .select("id, parcel_id, courier_id, status")
      .eq("id", params.bidId)
      .eq("parcel_id", params.id)
      .single<Pick<Bid, "id" | "parcel_id" | "courier_id" | "status">>();

    if (bidError || !bid) {
      return NextResponse.json({ error: "Bid not found" }, { status: 404 });
    }

    if (bid.courier_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (bid.status !== "active") {
      return NextResponse.json(
        { error: `Cannot withdraw a ${bid.status} bid` },
        { status: 400 }
      );
    }

    const { error: updateError } = await (
      adminClient.from("parcel_bids") as any
    )
      .update({ status: "withdrawn", updated_at: new Date().toISOString() })
      .eq("id", bid.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to withdraw bid", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[BIDDING] DELETE bid error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
