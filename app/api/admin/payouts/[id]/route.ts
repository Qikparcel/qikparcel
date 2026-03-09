import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * PATCH /api/admin/payouts/[id]
 * Update payout status and optional reference/notes (admin only).
 * Body: { status?: 'processed'|'paid'|'failed', payment_reference?: string, notes?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      status,
      payment_reference,
      notes,
    }: {
      status?: "processed" | "paid" | "failed";
      payment_reference?: string;
      notes?: string;
    } = body;

    const adminClient = createSupabaseAdminClient();
    const payoutId = params.id;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status && ["processed", "paid", "failed"].includes(status)) {
      updateData.status = status;
      if (status === "processed" || status === "paid") {
        updateData.processed_by = session.user.id;
        updateData.processed_at = new Date().toISOString();
      }
    }
    if (payment_reference !== undefined) {
      updateData.payment_reference =
        typeof payment_reference === "string"
          ? payment_reference.trim() || null
          : null;
    }
    if (notes !== undefined) {
      updateData.notes =
        typeof notes === "string" ? notes.trim() || null : null;
    }

    const payoutsTable = adminClient.from("payouts");
    const { error: updateError } = await (
      payoutsTable as unknown as {
        update: (d: Record<string, unknown>) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update(updateData)
      .eq("id", payoutId);

    if (updateError) {
      console.error("Admin payout PATCH error:", updateError);
      return NextResponse.json(
        { error: "Failed to update payout" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payout updated",
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/payouts/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
