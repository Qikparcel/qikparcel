import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/**
 * GET /api/chat/unread-count
 * Returns total unread message count for the current user across all their threads.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ count: 0 });
    }

    const userId = session.user.id;
    const adminClient = createSupabaseAdminClient();

    // Get all parcel IDs the user has access to (sender or courier of matched trip)
    const { data: parcelsAsSender } = await adminClient
      .from("parcels")
      .select("id")
      .eq("sender_id", userId)
      .not("matched_trip_id", "is", null);

    const { data: trips } = await adminClient
      .from("trips")
      .select("id")
      .eq("courier_id", userId);
    const tripIds = (trips || []).map((t: { id: string }) => t.id);

    const { data: parcelsAsCourier } =
      tripIds.length > 0
        ? await adminClient
            .from("parcels")
            .select("id")
            .in("matched_trip_id", tripIds)
        : { data: [] };

    const parcelIds = Array.from(
      new Set([
        ...(parcelsAsSender || []).map((p: { id: string }) => p.id),
        ...(parcelsAsCourier || []).map((p: { id: string }) => p.id),
      ])
    );

    if (parcelIds.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const { data: threads } = await adminClient
      .from("chat_threads")
      .select("id")
      .in("parcel_id", parcelIds);
    const threadIds = (threads || []).map((t: { id: string }) => t.id);

    if (threadIds.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    // For each thread: count messages where created_at > last_read_at AND sender_id != userId
    const { data: reads } = await adminClient
      .from("chat_thread_reads")
      .select("thread_id, last_read_at")
      .eq("user_id", userId)
      .in("thread_id", threadIds);

    const readMap = new Map(
      (reads || []).map((r: { thread_id: string; last_read_at: string }) => [
        r.thread_id,
        r.last_read_at,
      ])
    );

    // Count unread: messages in our threads where sender != me and (no read record or created_at > last_read_at)
    const { data: messages } = await adminClient
      .from("chat_messages")
      .select("id, thread_id, sender_id, created_at")
      .in("thread_id", threadIds)
      .neq("sender_id", userId);

    let unread = 0;
    (messages || []).forEach(
      (m: { thread_id: string; sender_id: string; created_at: string }) => {
        const lastRead = readMap.get(m.thread_id);
        if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
          unread += 1;
        }
      }
    );

    return NextResponse.json({ count: unread });
  } catch (error: unknown) {
    console.error("[CHAT] unread-count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
