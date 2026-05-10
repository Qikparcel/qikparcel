/**
 * Strike management for couriers who engage with bidding then fail to deliver
 * (won-then-withdrew, won-then-payment-timeout, etc.).
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

type StrikeReason =
  | "bid_won_withdrew"
  | "bid_won_payment_timeout"
  | "manual";

export async function recordStrike(
  supabase: SupabaseClient<Database>,
  args: {
    courierId: string;
    parcelId?: string | null;
    reason: StrikeReason;
    notes?: string;
  }
): Promise<void> {
  const { error } = await (supabase.from("courier_strikes") as any).insert({
    courier_id: args.courierId,
    parcel_id: args.parcelId ?? null,
    reason: args.notes ? `${args.reason}: ${args.notes}` : args.reason,
  });

  if (error) {
    console.error("[BIDDING] Failed to record strike:", error);
  } else {
    console.log(
      `[BIDDING] Strike recorded for courier ${args.courierId} (${args.reason})`
    );
  }
}

export async function excludeCourierFromParcel(
  supabase: SupabaseClient<Database>,
  args: {
    parcelId: string;
    courierId: string;
    reason:
      | "bid_won_withdrew"
      | "bid_won_payment_timeout"
      | "rejected_by_sender"
      | "manual_block";
  }
): Promise<void> {
  const { error } = await (
    supabase.from("parcel_courier_exclusions") as any
  ).insert({
    parcel_id: args.parcelId,
    courier_id: args.courierId,
    reason: args.reason,
  });

  if (error && error.code !== "23505") {
    // 23505 = unique violation (already excluded). Ignore.
    console.error("[BIDDING] Failed to exclude courier from parcel:", error);
  }
}
