import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { stripe, isStripeEnabled } from "@/lib/stripe/client";
import { Database } from "@/types/database";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];

/**
 * POST /api/payments/checkout
 * Create Stripe Checkout Session for sender to pay for a matched parcel
 * Body: { parcel_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!isStripeEnabled() || !stripe) {
      return NextResponse.json(
        { error: "Payments are not configured" },
        { status: 503 }
      );
    }

    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parcelId = body.parcel_id;
    if (!parcelId) {
      return NextResponse.json(
        { error: "parcel_id is required" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();

    // Get parcel and verify sender owns it
    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select("id, sender_id, status, matched_trip_id")
      .eq("id", parcelId)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    if (parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to pay for this parcel" },
        { status: 403 }
      );
    }

    if (parcel.status === "pending" || !parcel.matched_trip_id) {
      return NextResponse.json(
        { error: "Parcel must be matched before payment" },
        { status: 400 }
      );
    }

    // Get accepted match with pricing
    const { data: match, error: matchError } = await adminClient
      .from("parcel_trip_matches")
      .select(
        "id, total_amount, currency, stripe_payment_intent_id, payment_status"
      )
      .eq("parcel_id", parcelId)
      .eq("trip_id", parcel.matched_trip_id)
      .eq("status", "accepted")
      .single<Match>();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.payment_status === "paid") {
      return NextResponse.json(
        { error: "Payment already completed" },
        { status: 400 }
      );
    }

    const totalAmount = match.total_amount;
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: "No payment amount set for this match" },
        { status: 400 }
      );
    }

    const amountCents = Math.round(totalAmount * 100);
    const currency = (match.currency || "usd").toLowerCase();

    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!baseUrl) {
      baseUrl = "http://localhost:3000";
    }
    baseUrl = baseUrl.replace(/\/$/, ""); // no trailing slash

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "QikParcel Delivery",
              description: `Delivery for parcel ${parcelId.slice(0, 8)}...`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        parcel_id: parcelId,
        match_id: match.id,
        sender_id: session.user.id,
      },
      success_url: `${baseUrl}/dashboard/parcels/${parcelId}?payment=success`,
      cancel_url: `${baseUrl}/dashboard/parcels/${parcelId}?payment=cancelled`,
      customer_email: undefined, // Sender may not have email; phone auth
    });

    return NextResponse.json({
      url: checkoutSession.url,
      session_id: checkoutSession.id,
    });
  } catch (error: any) {
    console.error("[PAYMENTS] Checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout" },
      { status: 500 }
    );
  }
}
