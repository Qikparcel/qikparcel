import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { handleBiddingClose } from "@/lib/bidding/close-handler";
import { Database } from "@/types/database";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

/**
 * GET /api/cron/bidding-close
 *
 * Scheduled job (e.g. Vercel Cron, every 1-5 min):
 *  - Finds parcels in bidding mode whose window has expired and status is still pending.
 *  - Routes each through handleBiddingClose() so fallback rules kick in.
 *
 * Authentication: requires `Authorization: Bearer <CRON_SECRET>` header.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") || "";
    const provided = auth.replace(/^Bearer\s+/i, "");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    const { data: parcels, error } = await adminClient
      .from("parcels")
      .select("id, status, pricing_mode, bidding_closes_at")
      .eq("status", "pending")
      .eq("pricing_mode", "bidding")
      .not("bidding_closes_at", "is", null)
      .lte("bidding_closes_at", nowIso)
      .limit(50);

    if (error) {
      console.error("[CRON] bidding-close query error:", error);
      return NextResponse.json(
        { error: "Failed to query parcels", details: error.message },
        { status: 500 }
      );
    }

    const results: Array<{
      parcel_id: string;
      outcome: string;
      notes?: string;
    }> = [];

    for (const parcel of (parcels ?? []) as Pick<
      Parcel,
      "id" | "status" | "pricing_mode" | "bidding_closes_at"
    >[]) {
      const r = await handleBiddingClose(
        adminClient,
        parcel.id,
        "window_expired"
      );
      results.push({
        parcel_id: parcel.id,
        outcome: r.outcome,
        notes: r.notes,
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("[CRON] bidding-close error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
