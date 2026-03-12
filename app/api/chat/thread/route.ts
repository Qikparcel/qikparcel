import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { verifyPaidChatAccessForParcel } from "@/lib/chat/access";
import { Database } from "@/types/database";

type ChatThread = Database["public"]["Tables"]["chat_threads"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * GET /api/chat/thread?parcel_id=xxx
 * Get or create chat thread for parcel. Returns thread + messages with sender profiles.
 * Only for parcels where user is sender or courier (matched trip).
 */
export async function GET(request: NextRequest) {
  try {
    const parcelId = request.nextUrl.searchParams.get("parcel_id");
    if (!parcelId) {
      return NextResponse.json(
        { error: "parcel_id is required" },
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

    // Fetch parcel with admin client to bypass RLS (couriers can't SELECT parcels
    // due to migration 008 removing "Couriers can view matched parcels" policy)
    const adminClient = createSupabaseAdminClient();
    const access = await verifyPaidChatAccessForParcel(
      adminClient,
      parcelId,
      userId
    );

    if (!access.allowed) {
      return NextResponse.json(
        {
          thread: null,
          messages: [],
          error: access.error,
        },
        { status: access.status }
      );
    }

    // Get or create thread (use admin client to bypass RLS - auth.uid() can be
    // unset in API route context, and we've already verified access above)
    let { data: thread, error: threadError } = await adminClient
      .from("chat_threads")
      .select("*")
      .eq("parcel_id", parcelId)
      .single<ChatThread>();

    if (threadError && threadError.code === "PGRST116") {
      // No row - create thread
      const { data: rawNewThread, error: insertError } = await (
        adminClient.from("chat_threads") as any
      )
        .insert({ parcel_id: parcelId })
        .select()
        .single();
      const newThread = rawNewThread as ChatThread | null;
      if (insertError) {
        console.error("[CHAT] Failed to create thread:", insertError);
        return NextResponse.json(
          { error: "Failed to create chat thread" },
          { status: 500 }
        );
      }
      thread = newThread;
    } else if (threadError) {
      console.error("[CHAT] Thread error:", threadError);
      return NextResponse.json(
        { error: "Failed to load chat thread" },
        { status: 500 }
      );
    }

    if (!thread) {
      return NextResponse.json({
        thread: null,
        messages: [],
      });
    }

    // Fetch messages with sender profiles (admin client bypasses RLS)
    const { data: messages, error: messagesError } = await adminClient
      .from("chat_messages")
      .select(
        `
        id,
        thread_id,
        sender_id,
        content,
        created_at,
        sender:profiles!chat_messages_sender_id_fkey(id, full_name, role)
      `
      )
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("[CHAT] Messages error:", messagesError);
      return NextResponse.json({
        thread,
        messages: [],
        error: "Failed to load messages",
      });
    }

    type MessageRow = ChatMessage & {
      sender: Pick<Profile, "id" | "full_name" | "role"> | null;
    };
    const typedMessages = (messages ?? []) as MessageRow[];

    return NextResponse.json({
      thread,
      messages: typedMessages.map((m) => ({
        id: m.id,
        thread_id: m.thread_id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        sender_name: m.sender?.full_name || "Unknown",
        is_me: m.sender_id === userId,
      })),
    });
  } catch (error: unknown) {
    console.error("[CHAT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
