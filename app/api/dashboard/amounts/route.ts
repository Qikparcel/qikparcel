import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * GET /api/dashboard/amounts
 * Returns amount summaries for the current user by role:
 * - Sender: total amount paid (accepted matches with payment_status = paid)
 * - Courier: earnings in process (accepted, paid, parcel not yet delivered) and paid out (delivered)
 */
export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currency = "USD";

    if (profile.role === "sender") {
      const { data: parcels } = await supabase
        .from("parcels")
        .select("id")
        .eq("sender_id", session.user.id);
      const parcelIds = ((parcels ?? []) as { id: string }[]).map((p) => p.id);
      if (parcelIds.length === 0) {
        return NextResponse.json({
          totalPaid: 0,
          currency,
          role: "sender",
        });
      }
      const { data: matches } = await supabase
        .from("parcel_trip_matches")
        .select("total_amount, currency")
        .in("parcel_id", parcelIds)
        .eq("payment_status", "paid");
      type MatchRow = { total_amount: number | null; currency: string | null };
      const matchRows = (matches ?? []) as MatchRow[];
      const totalPaid = matchRows.reduce(
        (sum, m) => sum + (Number(m.total_amount) || 0),
        0
      );
      const matchCurrency = matchRows[0]?.currency || currency;
      return NextResponse.json({
        totalPaid: Math.round(totalPaid * 100) / 100,
        currency: matchCurrency,
        role: "sender",
      });
    }

    if (profile.role === "courier") {
      const { data: trips } = await supabase
        .from("trips")
        .select("id")
        .eq("courier_id", session.user.id);
      const tripIds = ((trips ?? []) as { id: string }[]).map((t) => t.id);
      if (tripIds.length === 0) {
        return NextResponse.json({
          earningsInProcess: 0,
          earningsPaidOut: 0,
          currency,
          role: "courier",
        });
      }
      const { data: matches } = await supabase
        .from("parcel_trip_matches")
        .select(
          "delivery_fee, currency, parcel:parcels!parcel_trip_matches_parcel_id_fkey(status)"
        )
        .in("trip_id", tripIds)
        .eq("status", "accepted")
        .eq("payment_status", "paid");

      type Row = {
        delivery_fee: number | null;
        currency: string | null;
        parcel: { status: string } | null;
      };
      const rows = (matches ?? []) as Row[];
      let inProcess = 0;
      let paidOut = 0;
      for (const row of rows) {
        const fee = Number(row.delivery_fee) || 0;
        const status = row.parcel?.status;
        if (status === "delivered") {
          paidOut += fee;
        } else {
          inProcess += fee;
        }
      }
      const matchCurrency = (rows[0]?.currency as string) || currency;
      return NextResponse.json({
        earningsInProcess: Math.round(inProcess * 100) / 100,
        earningsPaidOut: Math.round(paidOut * 100) / 100,
        currency: matchCurrency,
        role: "courier",
      });
    }

    return NextResponse.json({
      totalPaid: 0,
      earningsInProcess: 0,
      earningsPaidOut: 0,
      currency,
      role: profile.role,
    });
  } catch (error: unknown) {
    console.error("[DASHBOARD AMOUNTS]", error);
    return NextResponse.json(
      { error: "Failed to load amounts" },
      { status: 500 }
    );
  }
}
