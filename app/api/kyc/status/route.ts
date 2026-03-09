import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

type CourierKyc = Database["public"]["Tables"]["courier_kyc"]["Row"];

/**
 * GET /api/kyc/status
 * Returns current user's KYC status (courier only).
 */
export async function GET() {
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
      .single<{ role: string }>();

    if (!profile || profile.role !== "courier") {
      return NextResponse.json(
        { error: "Only couriers can access KYC status" },
        { status: 403 }
      );
    }

    const { data: kyc, error: kycError } = await supabase
      .from("courier_kyc")
      .select(
        "verification_status, id_document_type, rejection_reason, verified_at"
      )
      .eq("courier_id", session.user.id)
      .maybeSingle<
        Pick<
          CourierKyc,
          | "verification_status"
          | "id_document_type"
          | "rejection_reason"
          | "verified_at"
        >
      >();

    if (kycError) {
      console.error("KYC status error:", kycError);
      return NextResponse.json(
        { error: "Failed to load KYC status" },
        { status: 500 }
      );
    }

    // Also check if they have a document (without exposing path)
    const { data: hasDoc } = await supabase
      .from("courier_kyc")
      .select("id")
      .eq("courier_id", session.user.id)
      .not("id_document_url", "is", null)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      kyc: kyc
        ? {
            verification_status: kyc.verification_status,
            id_document_type: kyc.id_document_type ?? null,
            rejection_reason: kyc.rejection_reason ?? null,
            verified_at: kyc.verified_at ?? null,
            has_document: !!hasDoc,
          }
        : null,
    });
  } catch (error: any) {
    console.error("GET /api/kyc/status error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
