import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CourierKyc = Database["public"]["Tables"]["courier_kyc"]["Row"];

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/kyc
 * List courier KYC with profile. Query: status=pending|approved|rejected
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | null;

    const adminClient = createSupabaseAdminClient();

    let query = adminClient
      .from("courier_kyc")
      .select(
        "id, courier_id, id_document_type, verification_status, verified_at, rejection_reason, created_at, proof_of_address_url, selfie_with_id_url"
      )
      .order("created_at", { ascending: false });

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query = query.eq("verification_status", status);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("Admin KYC list error:", error);
      return NextResponse.json(
        { error: "Failed to load KYC list" },
        { status: 500 }
      );
    }

    const kycList = (rows || []) as Array<{
      id: string;
      courier_id: string;
      id_document_type: string | null;
      verification_status: string;
      verified_at: string | null;
      rejection_reason: string | null;
      created_at: string;
      proof_of_address_url: string | null;
      selfie_with_id_url: string | null;
    }>;

    const courierIds = [...new Set(kycList.map((r) => r.courier_id))];
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, phone_number")
      .in("id", courierIds);

    const profileMap = new Map(
      (profiles || []).map(
        (p: { id: string; full_name: string | null; phone_number: string }) => [
          p.id,
          { full_name: p.full_name, phone_number: p.phone_number },
        ]
      )
    );

    const list = kycList.map((row) => {
      const p = profileMap.get(row.courier_id);
      return {
        id: row.id,
        courier_id: row.courier_id,
        id_document_type: row.id_document_type,
        verification_status: row.verification_status,
        verified_at: row.verified_at,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        courier_name: p?.full_name ?? null,
        courier_phone: p?.phone_number ?? null,
        has_proof_of_address: !!row.proof_of_address_url,
        has_selfie_with_id: !!row.selfie_with_id_url,
      };
    });

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error("GET /api/admin/kyc error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
