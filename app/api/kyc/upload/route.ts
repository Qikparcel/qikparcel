import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/**
 * POST /api/kyc/upload
 * Upload ID document and upsert courier_kyc (courier only).
 * Body: multipart form with file + documentType (national_id | passport | drivers_license).
 */
export async function POST(request: NextRequest) {
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
        { error: "Only couriers can upload KYC documents" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentType =
      (formData.get("documentType") as string) || "national_id";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, and PDF files are allowed.",
        },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const validTypes = ["national_id", "passport", "drivers_license"];
    const docType = validTypes.includes(documentType)
      ? documentType
      : "national_id";

    const adminSupabase = createSupabaseAdminClient();
    const userId = session.user.id;
    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      "_"
    )}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminSupabase.storage
      .from("courier-documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("KYC upload storage error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { error: kycError } = await (
      adminSupabase.from("courier_kyc") as any
    ).upsert(
      {
        courier_id: userId,
        id_document_url: fileName,
        id_document_type: docType,
        verification_status: "pending",
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "courier_id" }
    );

    if (kycError) {
      console.error("KYC upsert error:", kycError);
      return NextResponse.json(
        { error: "Failed to save KYC record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document uploaded. It will be reviewed shortly.",
    });
  } catch (error: any) {
    console.error("POST /api/kyc/upload error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
