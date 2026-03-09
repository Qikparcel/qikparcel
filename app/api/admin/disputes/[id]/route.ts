import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type DisputeRow = Database["public"]["Tables"]["disputes"]["Row"];

const VALID_STATUSES = ["open", "investigating", "resolved", "closed"] as const;

/**
 * GET /api/admin/disputes/[id]
 * Fetch single dispute with parcel, raiser, and status history (admin only).
 */
export async function GET(
  _request: NextRequest,
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

    const adminClient = createSupabaseAdminClient();
    const disputeId = params.id;

    const { data: disputeData, error: disputeError } = await adminClient
      .from("disputes")
      .select(
        "id, parcel_id, raised_by, dispute_type, description, status, resolution_notes, resolved_by, resolved_at, created_at, updated_at"
      )
      .eq("id", disputeId)
      .single<
        Pick<
          DisputeRow,
          | "id"
          | "parcel_id"
          | "raised_by"
          | "dispute_type"
          | "description"
          | "status"
          | "resolution_notes"
          | "resolved_by"
          | "resolved_at"
          | "created_at"
          | "updated_at"
        >
      >();

    const dispute = disputeData;
    if (disputeError || !dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const [parcelRes, raiserRes, historyRes] = await Promise.all([
      adminClient
        .from("parcels")
        .select("id, pickup_address, delivery_address, status")
        .eq("id", dispute.parcel_id)
        .single(),
      adminClient
        .from("profiles")
        .select("id, full_name, phone_number")
        .eq("id", dispute.raised_by)
        .single(),
      adminClient
        .from("dispute_status_history")
        .select("id, from_status, to_status, changed_by, notes, created_at")
        .eq("dispute_id", disputeId)
        .order("created_at", { ascending: true }),
    ]);

    const changedByIds = Array.from(
      new Set(
        (historyRes.data || [])
          .map((h: { changed_by: string }) => h.changed_by)
          .filter(Boolean)
      )
    );
    const changers =
      changedByIds.length > 0
        ? await adminClient
            .from("profiles")
            .select("id, full_name")
            .in("id", changedByIds)
        : { data: [] };
    const changerMap = new Map(
      (changers.data || []).map(
        (p: { id: string; full_name: string | null }) => [
          p.id,
          p.full_name ?? "Admin",
        ]
      )
    );

    const history = (historyRes.data || []).map(
      (h: {
        id: string;
        from_status: string | null;
        to_status: string;
        changed_by: string;
        notes: string | null;
        created_at: string;
      }) => ({
        id: h.id,
        from_status: h.from_status,
        to_status: h.to_status,
        changed_by_name: changerMap.get(h.changed_by) ?? "Admin",
        notes: h.notes,
        created_at: h.created_at,
      })
    );

    return NextResponse.json({
      success: true,
      dispute: {
        ...dispute,
        parcel: parcelRes.data ?? null,
        raiser: raiserRes.data ?? null,
      },
      history,
    });
  } catch (error: any) {
    console.error("GET /api/admin/disputes/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/disputes/[id]
 * Update dispute status and resolution notes (admin only).
 * Records status change in dispute_status_history.
 * Body: { status?: 'open'|'investigating'|'resolved'|'closed', resolution_notes?: string }
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
      resolution_notes,
    }: {
      status?: "open" | "investigating" | "resolved" | "closed";
      resolution_notes?: string;
    } = body;

    const adminClient = createSupabaseAdminClient();
    const disputeId = params.id;

    // Fetch current dispute to get old status
    const { data: existing } = await adminClient
      .from("disputes")
      .select("status")
      .eq("id", disputeId)
      .single<{ status: string }>();

    if (!existing) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (
      status &&
      VALID_STATUSES.includes(status) &&
      status !== existing.status
    ) {
      updateData.status = status;
      if (status === "resolved" || status === "closed") {
        updateData.resolved_by = session.user.id;
        updateData.resolved_at = new Date().toISOString();
      } else {
        updateData.resolved_by = null;
        updateData.resolved_at = null;
      }
    }
    if (resolution_notes !== undefined) {
      updateData.resolution_notes =
        typeof resolution_notes === "string"
          ? resolution_notes.trim() || null
          : null;
    }

    const disputesQuery = adminClient.from("disputes");
    const { error: updateError } = await (
      disputesQuery as unknown as {
        update: (d: Record<string, unknown>) => {
          eq: (
            k: string,
            v: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .update(updateData)
      .eq("id", disputeId);

    if (updateError) {
      console.error("Admin dispute PATCH error:", updateError);
      return NextResponse.json(
        { error: "Failed to update dispute" },
        { status: 500 }
      );
    }

    // Record status change in history
    if (
      status &&
      VALID_STATUSES.includes(status) &&
      status !== existing.status
    ) {
      const notes =
        typeof resolution_notes === "string"
          ? resolution_notes.trim() || null
          : null;
      await (adminClient.from("dispute_status_history") as any).insert({
        dispute_id: disputeId,
        from_status: existing.status,
        to_status: status,
        changed_by: session.user.id,
        notes,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Dispute updated",
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/disputes/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
