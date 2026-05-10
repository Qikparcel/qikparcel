/**
 * Validators for bidding inputs (amounts, windows, eligibility checks).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { BIDDING_CONFIG } from "./config";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

export interface BidAmountBounds {
  min: number;
  max: number;
  estimate: number | null;
}

/** Compute allowed min/max bid bounds for a parcel. */
export function getBidAmountBounds(parcel: Parcel): BidAmountBounds {
  const estimate = parcel.bidding_estimate_amount;
  const explicitMin = parcel.bidding_min_amount;
  const explicitMax = parcel.bidding_max_amount;

  if (explicitMin != null && explicitMax != null) {
    return { min: explicitMin, max: explicitMax, estimate };
  }

  if (estimate != null) {
    return {
      min: explicitMin ?? round2(estimate * BIDDING_CONFIG.minBidFactor),
      max: explicitMax ?? round2(estimate * BIDDING_CONFIG.maxBidFactor),
      estimate,
    };
  }

  return {
    min: explicitMin ?? 0,
    max: explicitMax ?? Number.POSITIVE_INFINITY,
    estimate,
  };
}

export function validateBidAmount(
  parcel: Parcel,
  amount: number
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Bid amount must be a positive number" };
  }

  const { min, max } = getBidAmountBounds(parcel);
  if (amount < min) {
    return {
      ok: false,
      error: `Bid must be at least ${min.toFixed(2)} ${
        parcel.bidding_currency || "USD"
      }`,
    };
  }
  if (amount > max && Number.isFinite(max)) {
    return {
      ok: false,
      error: `Bid cannot exceed ${max.toFixed(2)} ${
        parcel.bidding_currency || "USD"
      }`,
    };
  }
  return { ok: true };
}

export function isBiddingOpen(parcel: Parcel, now: Date = new Date()): boolean {
  if (parcel.pricing_mode !== "bidding") return false;
  if (parcel.status !== "pending") return false;
  if (!parcel.bidding_closes_at) return false;
  return new Date(parcel.bidding_closes_at).getTime() > now.getTime();
}

/**
 * Check that a courier is eligible to bid:
 * - has KYC approved
 * - not currently excluded from this parcel
 * - not over the strike suspension threshold
 */
export async function assertCourierCanBid(
  supabase: SupabaseClient<Database>,
  courierId: string,
  parcelId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  // 1. Profile exists and is a courier
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", courierId)
    .single<{ role: "sender" | "courier" | "admin" }>();

  if (profileError || !profile) {
    return { ok: false, status: 404, error: "Profile not found" };
  }
  if (profile.role !== "courier") {
    return { ok: false, status: 403, error: "Only couriers can bid" };
  }

  // 2. KYC approved
  const { data: kyc } = await supabase
    .from("courier_kyc")
    .select("verification_status")
    .eq("courier_id", courierId)
    .single<{ verification_status: "pending" | "approved" | "rejected" }>();

  if (!kyc || kyc.verification_status !== "approved") {
    return {
      ok: false,
      status: 403,
      error: "KYC must be approved before placing bids",
    };
  }

  // 3. Not excluded for this specific parcel
  const { data: exclusion } = await supabase
    .from("parcel_courier_exclusions")
    .select("id")
    .eq("parcel_id", parcelId)
    .eq("courier_id", courierId)
    .maybeSingle();

  if (exclusion) {
    return {
      ok: false,
      status: 403,
      error: "You are not eligible to bid on this parcel",
    };
  }

  // 4. Not over strike threshold (count active strikes in window directly).
  const sinceIso = new Date(
    Date.now() - BIDDING_CONFIG.strikeWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const { count: strikeCount } = await supabase
    .from("courier_strikes")
    .select("id", { count: "exact", head: true })
    .eq("courier_id", courierId)
    .is("cleared_at", null)
    .gte("created_at", sinceIso);

  if (
    typeof strikeCount === "number" &&
    strikeCount >= BIDDING_CONFIG.strikeSuspensionThreshold
  ) {
    return {
      ok: false,
      status: 403,
      error: "Bidding privileges suspended due to recent strikes",
    };
  }

  return { ok: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
