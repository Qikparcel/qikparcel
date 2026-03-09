import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"];

const DISPUTE_TYPES = [
  "damage",
  "delay",
  "lost",
  "wrong_delivery",
  "other",
] as const;

/**
 * GET /api/disputes?parcel_id=xxx
 * List disputes for a parcel. Caller must be sender, courier for that parcel, or admin.
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

    const { searchParams } = new URL(request.url);
    const parcel_id = searchParams.get("parcel_id");

    if (!parcel_id) {
      return NextResponse.json(
        { error: "parcel_id query is required" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select("id, sender_id, matched_trip_id")
      .eq("id", parcel_id)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: string }>();

    const isAdmin = profile?.role === "admin";
    const isSender = parcel.sender_id === session.user.id;
    let isCourier = false;
    if (parcel.matched_trip_id) {
      const { data: trip } = await adminClient
        .from("trips")
        .select("courier_id")
        .eq("id", parcel.matched_trip_id)
        .single<Pick<Trip, "courier_id">>();
      isCourier = trip?.courier_id === session.user.id;
    }

    if (!isAdmin && !isSender && !isCourier) {
      return NextResponse.json(
        { error: "You cannot view disputes for this parcel" },
        { status: 403 }
      );
    }

    const { data: disputes, error: disputesError } = await adminClient
      .from("disputes")
      .select(
        "id, dispute_type, description, status, created_at, resolution_notes, resolved_at"
      )
      .eq("parcel_id", parcel_id)
      .order("created_at", { ascending: false });

    if (disputesError) {
      console.error("Disputes fetch error:", disputesError);
      return NextResponse.json(
        { error: "Failed to load disputes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, disputes: disputes || [] });
  } catch (error: any) {
    console.error("GET /api/disputes error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disputes
 * Raise a dispute for a parcel. Caller must be the parcel's sender or the matched trip's courier.
 * Body: { parcel_id, dispute_type, description }
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

    const body = await request.json();
    const { parcel_id, dispute_type, description } = body;

    if (!parcel_id || typeof parcel_id !== "string") {
      return NextResponse.json(
        { error: "parcel_id is required" },
        { status: 400 }
      );
    }

    if (
      !dispute_type ||
      !DISPUTE_TYPES.includes(dispute_type as (typeof DISPUTE_TYPES)[number])
    ) {
      return NextResponse.json(
        {
          error: `dispute_type must be one of: ${DISPUTE_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      return NextResponse.json(
        { error: "description cannot be empty" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: parcel, error: parcelError } = await adminClient
      .from("parcels")
      .select("id, sender_id, matched_trip_id")
      .eq("id", parcel_id)
      .single<Parcel>();

    if (parcelError || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    const isSender = parcel.sender_id === session.user.id;
    let isCourier = false;
    if (parcel.matched_trip_id) {
      const { data: trip } = await adminClient
        .from("trips")
        .select("courier_id")
        .eq("id", parcel.matched_trip_id)
        .single<Pick<Trip, "courier_id">>();
      isCourier = trip?.courier_id === session.user.id;
    }

    if (!isSender && !isCourier) {
      return NextResponse.json(
        {
          error:
            "You can only raise a dispute for parcels you sent or are delivering",
        },
        { status: 403 }
      );
    }

    const disputesTable = adminClient.from("disputes");
    const insertPayload = {
      parcel_id: parcel.id,
      raised_by: session.user.id,
      dispute_type: dispute_type as (typeof DISPUTE_TYPES)[number],
      description: trimmedDescription,
      status: "open" as const,
    };
    const { error: insertError } = await (
      disputesTable as unknown as {
        insert: (
          d: typeof insertPayload
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).insert(insertPayload);

    if (insertError) {
      console.error("Dispute insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create dispute" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Dispute reported. Our team will look into it.",
    });
  } catch (error: any) {
    console.error("POST /api/disputes error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
