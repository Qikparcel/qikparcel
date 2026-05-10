import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";
import { isBiddingEnabled } from "@/lib/bidding/config";
import { handleBiddingClose } from "@/lib/bidding/close-handler";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

/**
 * POST /api/bidding/parcels/[id]/close
 * Sender closes bidding early without picking a winner. Triggers fallback flow.
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
      .select("id, sender_id, status, pricing_mode")
      .eq("id", parcelId)
      .single<Pick<Parcel, "id" | "sender_id" | "status" | "pricing_mode">>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }
    if (parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only the sender can close bidding" },
        { status: 403 }
      );
    }
    if (parcel.pricing_mode !== "bidding" || parcel.status !== "pending") {
      return NextResponse.json(
        { error: "Bidding is not active on this parcel" },
        { status: 400 }
      );
    }

    const result = await handleBiddingClose(
      adminClient,
      parcelId,
      "sender_cancelled"
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[BIDDING] Close bidding error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
