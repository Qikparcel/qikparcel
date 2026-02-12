import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook
 * Stripe webhook handler - verifies signature and processes events
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      console.error("[STRIPE WEBHOOK] Stripe not configured");
      return NextResponse.json(
        { error: "Webhook handler not configured" },
        { status: 503 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not set");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const headersList = await headers();
    const signature = headersList.get("stripe-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature" },
        { status: 400 }
      );
    }

    const body = await request.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(
        "[STRIPE WEBHOOK] Signature verification failed:",
        err.message
      );
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const parcelId = session.metadata?.parcel_id;
        const matchId = session.metadata?.match_id;

        if (!parcelId || !matchId) {
          console.warn(
            "[STRIPE WEBHOOK] checkout.session.completed missing metadata"
          );
          break;
        }

        const pi = session.payment_intent;
        const paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? null;

        const { error } = await (adminClient.from("parcel_trip_matches") as any)
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntentId,
          })
          .eq("id", matchId);

        if (error) {
          console.error("[STRIPE WEBHOOK] Failed to update match:", error);
          return NextResponse.json(
            { error: "Failed to update payment status" },
            { status: 500 }
          );
        }

        console.log(
          `[STRIPE WEBHOOK] Payment completed for match ${matchId}, parcel ${parcelId}`
        );
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string | undefined;
        if (!paymentIntentId) break;

        const { data: matches } = await adminClient
          .from("parcel_trip_matches")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .limit(1);

        if (matches && matches.length > 0) {
          await (adminClient.from("parcel_trip_matches") as any)
            .update({ payment_status: "refunded" })
            .eq("id", matches[0].id);
          console.log(
            `[STRIPE WEBHOOK] Refund processed for match ${matches[0].id}`
          );
        }
        break;
      }

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Error:", error?.message ?? error);
    if (error?.stack) console.error("[STRIPE WEBHOOK] Stack:", error.stack);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
