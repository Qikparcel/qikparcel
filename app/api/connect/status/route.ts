import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { stripe, isStripeEnabled } from "@/lib/stripe/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * GET /api/connect/status
 * Returns Connect account status for current user (courier)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, stripe_account_id, stripe_account_onboarded")
      .eq("id", session.user.id)
      .single<
        Pick<Profile, "role" | "stripe_account_id" | "stripe_account_onboarded">
      >();

    if (!profile || profile.role !== "courier") {
      return NextResponse.json({
        hasAccount: false,
        onboarded: false,
        canReceivePayouts: false,
      });
    }

    let onboarded = Boolean(profile.stripe_account_onboarded);

    if (profile.stripe_account_id && isStripeEnabled() && stripe) {
      try {
        const account = await stripe.accounts.retrieve(
          profile.stripe_account_id
        );
        const detailsSubmitted = account.details_submitted ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        if (detailsSubmitted && !onboarded) {
          const adminClient = createSupabaseAdminClient();
          await (adminClient.from("profiles") as any)
            .update({
              stripe_account_onboarded: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.user.id);
          onboarded = true;
        }
        return NextResponse.json({
          hasAccount: true,
          onboarded: detailsSubmitted,
          canReceivePayouts: payoutsEnabled,
        });
      } catch (e) {
        console.warn("[CONNECT] Account retrieve failed:", e);
      }
    }

    return NextResponse.json({
      hasAccount: Boolean(profile.stripe_account_id),
      onboarded,
      canReceivePayouts: false,
    });
  } catch (error: any) {
    console.error("[CONNECT] Status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get status" },
      { status: 500 }
    );
  }
}
