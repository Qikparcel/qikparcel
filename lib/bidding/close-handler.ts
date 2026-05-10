/**
 * Bidding close handler — invoked when a bidding window expires, the sender
 * cancels early, the winning courier withdraws, or the sender misses the
 * payment window. Implements the "no winner" decision tree from the plan:
 *
 *   fixed   -> revert parcel to fixed-price matching, keep status=pending
 *   rebid   -> extend bidding window (if attempts remain)
 *   cancel  -> mark parcel cancelled, sender must relist
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { findAndCreateMatchesForParcel } from "@/lib/matching/service";
import { BIDDING_CONFIG } from "./config";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

export type CloseTrigger =
  | "window_expired"
  | "sender_cancelled"
  | "winner_withdrew"
  | "payment_window_expired";

export interface CloseResult {
  outcome:
    | "matched"
    | "fallback_fixed"
    | "fallback_rebid"
    | "fallback_cancel"
    | "noop";
  notes?: string;
}

/**
 * Close a bidding session and route to the appropriate fallback path.
 * Caller must use a supabase client with sufficient privileges (admin client
 * recommended) since this updates parcels and parcel_bids regardless of RLS.
 */
export async function handleBiddingClose(
  supabase: SupabaseClient<Database>,
  parcelId: string,
  trigger: CloseTrigger
): Promise<CloseResult> {
  const { data: parcel, error } = await supabase
    .from("parcels")
    .select("*")
    .eq("id", parcelId)
    .single<Parcel>();

  if (error || !parcel) {
    return { outcome: "noop", notes: `Parcel ${parcelId} not found` };
  }

  if (parcel.pricing_mode !== "bidding") {
    return { outcome: "noop", notes: "Parcel is not in bidding mode" };
  }

  if (parcel.status !== "pending") {
    return {
      outcome: "noop",
      notes: `Parcel status is ${parcel.status}, no close action needed`,
    };
  }

  console.log(
    `[BIDDING] Closing bidding for parcel ${parcelId} (trigger=${trigger}, attempt=${parcel.bidding_attempt_count})`
  );

  // Mark all currently-active bids as expired (they didn't win).
  await (supabase.from("parcel_bids") as any)
    .update({ status: "expired" })
    .eq("parcel_id", parcelId)
    .eq("status", "active");

  const fallback = parcel.fallback_mode ?? BIDDING_CONFIG.defaultFallbackMode;
  const attemptCount = (parcel.bidding_attempt_count ?? 0) + 1;
  const maxAttempts =
    parcel.max_bidding_attempts ?? BIDDING_CONFIG.defaultMaxBiddingAttempts;

  // rebid only valid if attempts remain
  if (fallback === "rebid" && attemptCount < maxAttempts) {
    const lastWindowMs =
      parcel.bidding_closes_at && parcel.bidding_opens_at
        ? new Date(parcel.bidding_closes_at).getTime() -
          new Date(parcel.bidding_opens_at).getTime()
        : BIDDING_CONFIG.defaultWindowHours * 60 * 60 * 1000;

    // Gentle 1.5x extension, capped at 24h
    const newWindowMs = Math.min(
      Math.round(lastWindowMs * 1.5),
      24 * 60 * 60 * 1000
    );
    const now = Date.now();
    const newOpens = new Date(now).toISOString();
    const newCloses = new Date(now + newWindowMs).toISOString();

    await (supabase.from("parcels") as any)
      .update({
        bidding_attempt_count: attemptCount,
        bidding_opens_at: newOpens,
        bidding_closes_at: newCloses,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcelId);

    return {
      outcome: "fallback_rebid",
      notes: `Re-opened bidding until ${newCloses}`,
    };
  }

  if (fallback === "cancel" || attemptCount >= maxAttempts) {
    await (supabase.from("parcels") as any)
      .update({
        status: "cancelled",
        bidding_attempt_count: attemptCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcelId);

    return {
      outcome: "fallback_cancel",
      notes:
        fallback === "cancel"
          ? "Sender chose cancel-on-failure"
          : "Max bidding attempts reached",
    };
  }

  // Default: switch to fixed-price matching, leave status=pending so the
  // matching engine picks it up. Existing parcel_courier_exclusions are
  // honoured by the finder filter.
  await (supabase.from("parcels") as any)
    .update({
      pricing_mode: "fixed",
      bidding_attempt_count: attemptCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parcelId);

  // Re-run matching now that we're in fixed mode.
  try {
    await findAndCreateMatchesForParcel(supabase, parcelId);
  } catch (e) {
    console.error(
      `[BIDDING] Re-match after fallback failed for parcel ${parcelId}:`,
      e
    );
  }

  return {
    outcome: "fallback_fixed",
    notes: "Reverted to fixed-price matching",
  };
}
