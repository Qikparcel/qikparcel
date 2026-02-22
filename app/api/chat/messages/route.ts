import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/chat/messages
 * Body: { thread_id: string, content: string }
 * Send a message in a chat thread. RLS ensures user can only send in threads they have access to.
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

    const { data: message, error } = await (
      supabase.from("chat_messages") as any
    )
      .insert({
        thread_id,
        sender_id: session.user.id,
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

    return NextResponse.json({ message, success: true });
  } catch (error: unknown) {
    console.error("[CHAT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
