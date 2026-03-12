import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { verifyPaidChatAccessForParcel } from "@/lib/chat/access";
import { notifyChatRecipientOfNewMessage } from "@/lib/matching/notifications";

/**
 * POST /api/chat/messages
 * Body: { thread_id: string, content: string }
 * Sends a message in a chat thread. Uses admin client to bypass RLS (auth.uid()
 * can be unset in API context). Access is verified before insert.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thread_id, content } = body;

    if (!thread_id || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "thread_id and content (non-empty) are required" },
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

    // Verify user has access to thread (sender or courier of parcel)
    const adminClient = createSupabaseAdminClient();
    const { data: thread } = await adminClient
      .from("chat_threads")
      .select("id, parcel_id")
      .eq("id", thread_id)
      .single<{ id: string; parcel_id: string }>();

    if (!thread?.parcel_id) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const access = await verifyPaidChatAccessForParcel(
      adminClient,
      thread.parcel_id,
      userId
    );
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const { data: message, error } = await (
      adminClient.from("chat_messages") as any
    )
      .insert({
        thread_id,
        sender_id: userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Thread not found or access denied" },
          { status: 404 }
        );
      }
      console.error("[CHAT] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Fire-and-forget: notify recipient via WhatsApp if they haven't been active
    notifyChatRecipientOfNewMessage(
      adminClient,
      thread_id,
      userId,
      thread.parcel_id
    ).catch(() => {});

    return NextResponse.json({ message, success: true });
  } catch (error: unknown) {
    console.error("[CHAT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
