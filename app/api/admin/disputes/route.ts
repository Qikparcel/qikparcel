import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/disputes
 * List disputes with parcel and raiser info. Query: status=open|investigating|resolved|closed
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
      | "open"
      | "investigating"
      | "resolved"
      | "closed"
      | null;

    const adminClient = createSupabaseAdminClient();

    let query = adminClient
      .from("disputes")
      .select(
        "id, parcel_id, raised_by, dispute_type, description, status, resolution_notes, resolved_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (
      status &&
      ["open", "investigating", "resolved", "closed"].includes(status)
    ) {
      query = query.eq("status", status);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("Admin disputes list error:", error);
      return NextResponse.json(
        { error: "Failed to load disputes" },
        { status: 500 }
      );
    }

    const disputes = (rows || []) as Array<{
      id: string;
      parcel_id: string;
      raised_by: string;
      dispute_type: string;
      description: string;
      status: string;
      resolution_notes: string | null;
      resolved_at: string | null;
      created_at: string;
    }>;

    const raiserIds = [...new Set(disputes.map((d) => d.raised_by))];

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, phone_number")
      .in("id", raiserIds);

    const profileMap = new Map(
      (profiles || []).map(
        (p: { id: string; full_name: string | null; phone_number: string }) => [
          p.id,
          { full_name: p.full_name, phone_number: p.phone_number },
        ]
      )
    );

    const list = disputes.map((d) => {
      const p = profileMap.get(d.raised_by);
      return {
        ...d,
        raiser_name: p?.full_name ?? null,
        raiser_phone: p?.phone_number ?? null,
      };
    });

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error("GET /api/admin/disputes error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
