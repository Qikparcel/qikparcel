import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { stripe, isStripeEnabled } from "@/lib/stripe/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * POST /api/connect/onboard
 * Create Stripe Connect Express account (if needed) and return onboarding link for couriers
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, stripe_account_id, country")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role" | "stripe_account_id" | "country">>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "courier") {
      return NextResponse.json(
        { error: "Only couriers can connect a payout account" },
        { status: 403 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    let accountId = profile.stripe_account_id;

    if (!accountId) {
      const country = (profile.country || "US").toUpperCase().slice(0, 2);
      const account = await stripe.accounts.create({
        type: "express",
        country: country === "EE" ? "EE" : country === "GB" ? "GB" : "US",
        email: session.user.email ?? undefined,
      });
      accountId = account.id;

      await (adminClient.from("profiles") as any)
        .update({
          stripe_account_id: accountId,
          stripe_account_onboarded: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    const base = baseUrl.replace(/\/$/, "");

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/dashboard/settings?connect=refresh`,
      return_url: `${base}/dashboard/settings?connect=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("[CONNECT] Onboard error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
