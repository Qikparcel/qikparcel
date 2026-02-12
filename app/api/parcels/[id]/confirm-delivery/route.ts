import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { stripe, isStripeEnabled } from "@/lib/stripe/client";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Match = Database["public"]["Tables"]["parcel_trip_matches"]["Row"];

/**
 * POST /api/parcels/[id]/confirm-delivery
 * Sender confirms that the parcel was delivered. This triggers the courier payout (Stripe Connect transfer).
 * Payout runs only after: parcel status = delivered, sender has confirmed, payment is paid, courier has Connect.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select("id, status, sender_id, matched_trip_id")
      .eq("id", parcelId)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    if (parcel.sender_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only the sender can confirm delivery" },
        { status: 403 }
      );
    }

    if (parcel.status !== "delivered") {
      return NextResponse.json(
        {
          error:
            "Parcel must be marked as delivered by the courier before you can confirm.",
        },
        { status: 400 }
      );
    }

    if (!parcel.matched_trip_id) {
      return NextResponse.json(
        { error: "Parcel is not matched to a trip" },
        { status: 400 }
      );
    }

    const { data: match, error: matchError } = await adminClient
      .from("parcel_trip_matches")
      .select(
        "id, delivery_fee, currency, payment_status, delivery_confirmed_by_sender_at"
      )
      .eq("parcel_id", parcelId)
      .eq("trip_id", parcel.matched_trip_id)
      .eq("status", "accepted")
      .single<
        Pick<
          Match,
          | "id"
          | "delivery_fee"
          | "currency"
          | "payment_status"
          | "delivery_confirmed_by_sender_at"
        >
      >();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.delivery_confirmed_by_sender_at) {
      return NextResponse.json({
        success: true,
        message: "Delivery was already confirmed",
        already_confirmed: true,
      });
    }

    const now = new Date().toISOString();
    const { error: updateMatchError } = await (
      adminClient.from("parcel_trip_matches") as any
    )
      .update({ delivery_confirmed_by_sender_at: now })
      .eq("id", match.id);

    if (updateMatchError) {
      console.error("[CONFIRM-DELIVERY] Update match error:", updateMatchError);
      return NextResponse.json(
        { error: "Failed to confirm delivery" },
        { status: 500 }
      );
    }

    // Trigger courier payout if conditions are met
    if (
      isStripeEnabled() &&
      stripe &&
      match.payment_status === "paid" &&
      match.delivery_fee != null &&
      match.delivery_fee > 0 &&
      match.currency
    ) {
      const { data: trip } = await adminClient
        .from("trips")
        .select("courier_id")
        .eq("id", parcel.matched_trip_id)
        .single<Pick<Trip, "courier_id">>();

      if (trip?.courier_id) {
        const { data: existingPayout } = await adminClient
          .from("payouts")
          .select("id")
          .eq("parcel_id", parcelId)
          .maybeSingle();

        if (!existingPayout) {
          const { data: courierProfile } = await adminClient
            .from("profiles")
            .select("stripe_account_id")
            .eq("id", trip.courier_id)
            .single<Pick<Profile, "stripe_account_id">>();

          if (courierProfile?.stripe_account_id) {
            try {
              const amountCents = Math.round(Number(match.delivery_fee) * 100);
              const transfer = await stripe.transfers.create({
                amount: amountCents,
                currency: (match.currency || "usd").toLowerCase(),
                destination: courierProfile.stripe_account_id,
                description: `Delivery fee for parcel ${parcelId}`,
              });
              await (adminClient.from("payouts") as any).insert({
                courier_id: trip.courier_id,
                parcel_id: parcelId,
                amount: Number(match.delivery_fee),
                status: "paid",
                stripe_transfer_id: transfer.id,
                processed_at: new Date().toISOString(),
                payment_reference: transfer.id,
              });
            } catch (err: any) {
              console.error(
                "[CONFIRM-DELIVERY] Transfer failed for parcel",
                parcelId,
                err
              );
              return NextResponse.json({
                success: true,
                message:
                  "Delivery confirmed. Payout to courier could not be completed and may be retried by support.",
                payout_failed: true,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Delivery confirmed. The courier will receive their payment.",
    });
  } catch (error: any) {
    console.error("Error in POST /api/parcels/[id]/confirm-delivery:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
