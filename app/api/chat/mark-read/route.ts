import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/**
 * POST /api/chat/mark-read
 * Body: { thread_id: string }
 * Marks a thread as read for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thread_id } = body;

    if (!thread_id) {
      return NextResponse.json(
        { error: "thread_id is required" },
        { status: 400 }
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

    const userId = session.user.id;
    const adminClient = createSupabaseAdminClient();

    // Verify user has access to thread
    const { data: thread } = await adminClient
      .from("chat_threads")
      .select("id, parcel_id")
      .eq("id", thread_id)
      .single();

    if (!thread?.parcel_id) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const { data: parcel } = await adminClient
      .from("parcels")
      .select("sender_id, matched_trip_id")
      .eq("id", thread.parcel_id)
      .single();

    if (!parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    const isSender = parcel.sender_id === userId;
    let isCourier = false;
    if (parcel.matched_trip_id) {
      const { data: trip } = await adminClient
        .from("trips")
        .select("courier_id")
        .eq("id", parcel.matched_trip_id)
        .single();
      isCourier = trip?.courier_id === userId;
    }

    if (!isSender && !isCourier) {
      return NextResponse.json(
        { error: "You cannot access this thread" },
        { status: 403 }
      );
    }

    await adminClient.from("chat_thread_reads").upsert(
      {
        user_id: userId,
        thread_id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id, thread_id" }
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[CHAT] mark-read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
