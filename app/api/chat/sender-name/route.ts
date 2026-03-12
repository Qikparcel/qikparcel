import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { verifyPaidChatAccessForParcel } from "@/lib/chat/access";

/**
 * GET /api/chat/sender-name?sender_id=xxx&thread_id=yyy
 * Returns full_name for a message sender. Verifies requester has access to the thread.
 */
export async function GET(request: NextRequest) {
  try {
    const senderId = request.nextUrl.searchParams.get("sender_id");
    const threadId = request.nextUrl.searchParams.get("thread_id");

    if (!senderId || !threadId) {
      return NextResponse.json(
        { error: "sender_id and thread_id are required" },
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

    const { data: thread } = await adminClient
      .from("chat_threads")
      .select("id, parcel_id")
      .eq("id", threadId)
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

    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", senderId)
      .single<{ full_name: string | null }>();

    return NextResponse.json({
      full_name: profile?.full_name || "Unknown",
    });
  } catch (error: unknown) {
    console.error("[CHAT] sender-name error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
