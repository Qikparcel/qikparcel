import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * PATCH /api/admin/kyc/[id]
 * Approve or reject KYC (admin only).
 * Body: { verification_status: 'approved' | 'rejected', rejection_reason?: string }
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
      verification_status,
      rejection_reason,
    }: {
      verification_status?: "approved" | "rejected";
      rejection_reason?: string;
    } = body;

    if (
      !verification_status ||
      !["approved", "rejected"].includes(verification_status)
    ) {
      return NextResponse.json(
        { error: "verification_status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const kycId = params.id;

    const updateData: Record<string, unknown> = {
      verification_status,
      verified_by: session.user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (verification_status === "approved") {
      updateData.rejection_reason = null;
    } else if (rejection_reason != null) {
      updateData.rejection_reason =
        typeof rejection_reason === "string" ? rejection_reason.trim() : null;
    }

    const kyctable = adminClient.from("courier_kyc");
    const { error: updateError } = await (
      kyctable as unknown as {
        update: (d: Record<string, unknown>) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update(updateData)
      .eq("id", kycId);

    if (updateError) {
      console.error("Admin KYC PATCH error:", updateError);
      return NextResponse.json(
        { error: "Failed to update KYC status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        verification_status === "approved" ? "KYC approved" : "KYC rejected",
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/kyc/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
