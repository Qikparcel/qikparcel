import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CourierKyc = Database["public"]["Tables"]["courier_kyc"]["Row"];

const EXPIRES_IN = 3600; // 1 hour

/**
 * GET /api/admin/kyc/[id]/document-url
 * Returns a signed URL for the KYC document (admin only).
 */
export async function GET(
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

    const kycId = params.id;
    const adminClient = createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const doc = searchParams.get("doc") || "id"; // id | proof_of_address | selfie_with_id

    const { data: kyc, error: kycError } = await adminClient
      .from("courier_kyc")
      .select("id_document_url, proof_of_address_url, selfie_with_id_url")
      .eq("id", kycId)
      .single<
        Pick<
          CourierKyc,
          "id_document_url" | "proof_of_address_url" | "selfie_with_id_url"
        >
      >();

    if (kycError || !kyc) {
      return NextResponse.json(
        { error: "KYC record not found" },
        { status: 404 }
      );
    }

    const path =
      doc === "proof_of_address"
        ? kyc.proof_of_address_url
        : doc === "selfie_with_id"
        ? kyc.selfie_with_id_url
        : kyc.id_document_url;

    if (!path) {
      return NextResponse.json(
        {
          error:
            doc === "id"
              ? "Document not found"
              : `${doc.replace("_", " ")} not uploaded`,
        },
        { status: 404 }
      );
    }

    const { data: signed, error: signError } = await adminClient.storage
      .from("courier-documents")
      .createSignedUrl(path, EXPIRES_IN);

    if (signError) {
      console.error("Signed URL error:", signError);
      return NextResponse.json(
        { error: "Failed to generate document URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: signed?.signedUrl ?? null,
    });
  } catch (error: any) {
    console.error("GET /api/admin/kyc/[id]/document-url error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
