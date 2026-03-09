import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payouts
 * List payouts with courier and parcel info. Query: status=pending|processed|paid|failed
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
      | "processed"
      | "paid"
      | "failed"
      | null;

    const adminClient = createSupabaseAdminClient();

    let query = adminClient
      .from("payouts")
      .select(
        "id, courier_id, parcel_id, amount, status, processed_at, payment_reference, notes, created_at"
      )
      .order("created_at", { ascending: false });

    if (status && ["pending", "processed", "paid", "failed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: payoutRows, error } = await query;

    if (error) {
      console.error("Admin payouts list error:", error);
      return NextResponse.json(
        { error: "Failed to load payouts" },
        { status: 500 }
      );
    }

    const payouts = (payoutRows || []) as Array<{
      id: string;
      courier_id: string;
      parcel_id: string;
      amount: number;
      status: string;
      processed_at: string | null;
      payment_reference: string | null;
      notes: string | null;
      created_at: string;
    }>;

    const courierIds = [...new Set(payouts.map((p) => p.courier_id))];
    const parcelIds = [...new Set(payouts.map((p) => p.parcel_id))];

    const [profilesRes, parcelsRes] = await Promise.all([
      adminClient
        .from("profiles")
        .select("id, full_name, phone_number")
        .in("id", courierIds),
      adminClient
        .from("parcels")
        .select("id, pickup_address, delivery_address, status")
        .in("id", parcelIds),
    ]);

    const profileMap = new Map(
      (profilesRes.data || []).map(
        (p: { id: string; full_name: string | null; phone_number: string }) => [
          p.id,
          { full_name: p.full_name, phone_number: p.phone_number },
        ]
      )
    );
    const parcelMap = new Map(
      (parcelsRes.data || []).map(
        (p: {
          id: string;
          pickup_address: string;
          delivery_address: string;
          status: string;
        }) => [
          p.id,
          {
            pickup_address: p.pickup_address,
            delivery_address: p.delivery_address,
            status: p.status,
          },
        ]
      )
    );

    const list = payouts.map((p) => {
      const courier = profileMap.get(p.courier_id);
      const parcel = parcelMap.get(p.parcel_id);
      return {
        id: p.id,
        courier_id: p.courier_id,
        parcel_id: p.parcel_id,
        amount: Number(p.amount),
        status: p.status,
        processed_at: p.processed_at,
        payment_reference: p.payment_reference,
        notes: p.notes,
        created_at: p.created_at,
        courier_name: courier?.full_name ?? null,
        courier_phone: courier?.phone_number ?? null,
        parcel_status: parcel?.status ?? null,
      };
    });

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error("GET /api/admin/payouts error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
