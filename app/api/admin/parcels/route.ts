import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Parcel = Database["public"]["Tables"]["parcels"]["Row"];

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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<Pick<Profile, "role">>();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

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

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build query
    let query = adminClient
      .from("parcels")
      .select(
        `
        *,
        sender:profiles!parcels_sender_id_fkey(
          id,
          full_name,
          phone_number,
          email
        ),
        matches:parcel_trip_matches(
          id,
          trip_id,
          match_score,
          status,
          matched_at,
          accepted_at,
          trip:trips!parcel_trip_matches_trip_id_fkey(
            id,
            origin_address,
            destination_address,
            courier:profiles!trips_courier_id_fkey(
              id,
              full_name,
              phone_number
            )
          )
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Apply search: by sender (name, phone, email) or by pickup/delivery address
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const { data: senderProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("role", "sender")
        .or(
          `full_name.ilike.${term},phone_number.ilike.${term},email.ilike.${term}`
        );
      const senderIds = (senderProfiles || []).map((p: { id: string }) => p.id);
      const senderConditions = senderIds
        .map((id) => `sender_id.eq.${id}`)
        .join(",");
      const addressConditions = `pickup_address.ilike.${term},delivery_address.ilike.${term}`;
      const orClause = senderConditions
        ? `${senderConditions},${addressConditions}`
        : addressConditions;
      query = query.or(orClause);
    }

    const { data: parcels, error: parcelsError } = await query;

    if (parcelsError) {
      console.error("Error fetching parcels:", parcelsError);
      return NextResponse.json(
        { error: "Failed to fetch parcels", details: parcelsError.message },
        { status: 500 }
      );
    }

    // Normalize matches - Supabase might return arrays for foreign key relationships
    const normalizedParcels = (parcels || []).map((parcel: any) => {
      if (parcel.matches) {
        // Handle case where matches might be an array or single object
        if (Array.isArray(parcel.matches)) {
          parcel.matches = parcel.matches.map((match: any) => {
            // Normalize trip if it's an array
            if (match.trip && Array.isArray(match.trip)) {
              match.trip = match.trip[0] || null;
            }
            return match;
          });
        }
      }
      return parcel;
    });

    // Get total count for pagination
    let countQuery = adminClient
      .from("parcels")
      .select("*", { count: "exact", head: true });

    if (status && status !== "all") {
      countQuery = countQuery.eq("status", status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const { data: senderProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("role", "sender")
        .or(
          `full_name.ilike.${term},phone_number.ilike.${term},email.ilike.${term}`
        );
      const senderIds = (senderProfiles || []).map((p: { id: string }) => p.id);
      const senderConditions = senderIds
        .map((id) => `sender_id.eq.${id}`)
        .join(",");
      const addressConditions = `pickup_address.ilike.${term},delivery_address.ilike.${term}`;
      const orClause = senderConditions
        ? `${senderConditions},${addressConditions}`
        : addressConditions;
      countQuery = countQuery.or(orClause);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      success: true,
      parcels: normalizedParcels,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/parcels:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
