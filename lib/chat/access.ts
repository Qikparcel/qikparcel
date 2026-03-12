import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

type ChatAccessResult =
  | {
      allowed: true;
      parcel_id: string;
      sender_id: string;
      matched_trip_id: string;
      isSender: boolean;
      isCourier: boolean;
    }
  | {
      allowed: false;
      status: number;
      error: string;
    };

/**
 * Verify sender/courier access and ensure chat is unlocked by payment.
 */
export async function verifyPaidChatAccessForParcel(
  adminClient: SupabaseClient<Database>,
  parcelId: string,
  userId: string
): Promise<ChatAccessResult> {
  const { data: parcel } = await adminClient
    .from("parcels")
    .select("id, sender_id, matched_trip_id, status")
    .eq("id", parcelId)
    .single<{
      id: string;
      sender_id: string;
      matched_trip_id: string | null;
      status: string;
    }>();

  if (!parcel) {
    return { allowed: false, status: 404, error: "Parcel not found" };
  }

  const isSender = parcel.sender_id === userId;
  let isCourier = false;
  if (parcel.matched_trip_id) {
    const { data: trip } = await adminClient
      .from("trips")
      .select("courier_id")
      .eq("id", parcel.matched_trip_id)
      .single<{ courier_id: string }>();
    isCourier = trip?.courier_id === userId;
  }

  if (!isSender && !isCourier) {
    return {
      allowed: false,
      status: 403,
      error: "You cannot access this parcel's chat",
    };
  }

  // No chat until parcel has an accepted match.
  if (!parcel.matched_trip_id || parcel.status === "pending") {
    return {
      allowed: false,
      status: 403,
      error: "Chat is available once a courier is matched",
    };
  }

  const { data: acceptedMatch } = await adminClient
    .from("parcel_trip_matches")
    .select("payment_status")
    .eq("parcel_id", parcel.id)
    .eq("trip_id", parcel.matched_trip_id)
    .eq("status", "accepted")
    .single<{ payment_status: string | null }>();

  if (!acceptedMatch || acceptedMatch.payment_status !== "paid") {
    return {
      allowed: false,
      status: 403,
      error: "Chat is available once payment is completed",
    };
  }

  return {
    allowed: true,
    parcel_id: parcel.id,
    sender_id: parcel.sender_id,
    matched_trip_id: parcel.matched_trip_id,
    isSender,
    isCourier,
  };
}
