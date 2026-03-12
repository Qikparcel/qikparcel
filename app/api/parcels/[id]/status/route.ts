import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ParcelStatusHistoryInsert =
  Database["public"]["Tables"]["parcel_status_history"]["Insert"];

/**
 * POST /api/parcels/[id]/status
 * Update parcel status (for couriers)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parcelId = params.id;
    const supabase = createClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only couriers and admins can update parcel status
    if (profile.role !== "courier" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Only couriers can update parcel status" },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let status = "";
    let notes: string | null = null;
    let location: string | null = null;
    let proofPhoto: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      status = String(formData.get("status") || "");
      notes = formData.get("notes") ? String(formData.get("notes")) : null;
      location = formData.get("location")
        ? String(formData.get("location"))
        : null;
      const file = formData.get("proof_photo");
      proofPhoto = file instanceof File && file.size > 0 ? file : null;
    } else {
      const body = await request.json();
      status = body.status;
      notes = body.notes || null;
      location = body.location || null;
    }

    // Validate status
    const validStatuses = ["picked_up", "in_transit", "delivered", "cancelled"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const requiresProofPhoto =
      profile.role === "courier" &&
      ["picked_up", "in_transit", "delivered"].includes(status);
    if (requiresProofPhoto && !proofPhoto) {
      return NextResponse.json(
        {
          error:
            "A proof photo is required when moving parcel to the next timeline status.",
        },
        { status: 400 }
      );
    }

    if (proofPhoto) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(proofPhoto.type)) {
        return NextResponse.json(
          { error: "Invalid image type. Allowed: JPEG, PNG, WEBP." },
          { status: 400 }
        );
      }
      const maxSize = 8 * 1024 * 1024; // 8MB
      if (proofPhoto.size > maxSize) {
        return NextResponse.json(
          { error: "Image size exceeds 8MB limit." },
          { status: 400 }
        );
      }
    }

    // Use admin client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get parcel to verify courier has access
    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select("id, status, matched_trip_id, sender_id")
      .eq("id", parcelId)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    // Verify parcel is matched to a trip
    if (!parcel.matched_trip_id) {
      return NextResponse.json(
        { error: "Parcel is not matched to any trip" },
        { status: 400 }
      );
    }

    // Verify courier owns the matched trip
    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select("courier_id, status")
      .eq("id", parcel.matched_trip_id)
      .single<Pick<Trip, "courier_id" | "status">>();

    if (tripError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (profile.role !== "admin" && trip.courier_id !== session.user.id) {
      return NextResponse.json(
        {
          error:
            "Unauthorized: You can only update status for parcels matched to your trips",
        },
        { status: 403 }
      );
    }

    // Couriers cannot move parcel forward until sender payment is completed.
    const forwardStatuses = ["picked_up", "in_transit", "delivered"];
    if (profile.role === "courier" && forwardStatuses.includes(status)) {
      const { data: acceptedMatch } = await adminClient
        .from("parcel_trip_matches")
        .select("payment_status")
        .eq("parcel_id", parcelId)
        .eq("trip_id", parcel.matched_trip_id)
        .eq("status", "accepted")
        .single<{ payment_status: string | null }>();

      if (!acceptedMatch || acceptedMatch.payment_status !== "paid") {
        return NextResponse.json(
          {
            error:
              "Cannot move parcel forward yet. We are waiting for payment from sender side.",
          },
          { status: 400 }
        );
      }
    }

    // Validate status transitions
    const currentStatus = parcel.status;
    const validTransitions: Record<string, string[]> = {
      matched: ["picked_up", "cancelled"],
      picked_up: ["in_transit", "cancelled"],
      in_transit: ["delivered", "cancelled"],
      delivered: [], // Final state
      cancelled: [], // Final state
      pending: [], // Should not reach here
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${status}`,
          validTransitions: validTransitions[currentStatus] || [],
        },
        { status: 400 }
      );
    }

    let proofPhotoPath: string | null = null;
    if (proofPhoto) {
      const timestamp = Date.now();
      const safeFileName = proofPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      proofPhotoPath = `${parcelId}/${status}/${session.user.id}-${timestamp}-${safeFileName}`;

      const arrayBuffer = await proofPhoto.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const uploadWithBucket = async () =>
        adminClient.storage
          .from("parcel-proof-photos")
          .upload(proofPhotoPath as string, buffer, {
            contentType: proofPhoto.type,
            upsert: false,
          });

      let { error: uploadError } = await uploadWithBucket();

      // Self-heal missing bucket in environments where migration wasn't run yet.
      if ((uploadError as any)?.statusCode === "404") {
        const { error: createBucketError } =
          await adminClient.storage.createBucket("parcel-proof-photos", {
            public: false,
            fileSizeLimit: 8 * 1024 * 1024,
            allowedMimeTypes: [
              "image/jpeg",
              "image/jpg",
              "image/png",
              "image/webp",
            ],
          });

        if (!createBucketError) {
          const retry = await uploadWithBucket();
          uploadError = retry.error;
        } else {
          console.error(
            "Error creating parcel-proof-photos bucket:",
            createBucketError
          );
        }
      }

      if (uploadError) {
        console.error("Error uploading status proof photo:", uploadError);
        return NextResponse.json(
          {
            error: "Failed to upload proof photo",
            details:
              uploadError.message ||
              "Storage bucket missing or inaccessible. Please run latest migrations.",
          },
          { status: 500 }
        );
      }
    }

    // Update parcel status
    const { error: updateError } = await (adminClient.from("parcels") as any)
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parcelId);

    if (updateError) {
      console.error("Error updating parcel status:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update parcel status",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Keep trip lifecycle in sync: once any matched parcel is picked up, trip
    // moves from scheduled to in_progress.
    if (status === "picked_up" && trip.status === "scheduled") {
      const { error: tripUpdateError } = await (
        adminClient.from("trips") as any
      )
        .update({
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", parcel.matched_trip_id);

      if (tripUpdateError) {
        console.error(
          "Error updating trip status to in_progress:",
          tripUpdateError
        );
        return NextResponse.json(
          {
            error: "Parcel was updated but failed to update trip status",
            details: tripUpdateError.message,
          },
          { status: 500 }
        );
      }
    }

    // Create status history entry
    const statusHistoryData: ParcelStatusHistoryInsert = {
      parcel_id: parcelId,
      status,
      notes: notes || null,
      location: location || null,
      proof_photo_path: proofPhotoPath,
      proof_photo_uploaded_by: proofPhotoPath ? session.user.id : null,
    };

    await adminClient
      .from("parcel_status_history")
      .insert(statusHistoryData as any);

    // Payout to courier happens only when sender confirms delivery (POST /api/parcels/[id]/confirm-delivery)

    return NextResponse.json({
      success: true,
      message: `Parcel status updated to ${status}`,
      status,
    });
  } catch (error: any) {
    console.error("Error in POST /api/parcels/[id]/status:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
