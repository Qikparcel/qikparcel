import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * GET /api/ratings?parcel_id=xxx | ?user_id=xxx
 * - parcel_id: list ratings for a parcel (to check if user already rated, show reviews)
 * - user_id: list ratings received by a user (for profile - avg + count + reviews)
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
    const parcelId = searchParams.get("parcel_id");
    const userId = searchParams.get("user_id");

    if (parcelId) {
      // Get ratings for a parcel - caller must have access to the parcel
      const adminClient = createSupabaseAdminClient();
      const { data: parcel } = await adminClient
        .from("parcels")
        .select("id, sender_id, matched_trip_id")
        .eq("id", parcelId)
        .single<{
          id: string;
          sender_id: string;
          matched_trip_id: string | null;
        }>();

      if (!parcel) {
        return NextResponse.json(
          { error: "Parcel not found" },
          { status: 404 }
        );
      }

      let hasAccess = false;
      if (parcel.sender_id === session.user.id) hasAccess = true;
      if (parcel.matched_trip_id) {
        const { data: trip } = await adminClient
          .from("trips")
          .select("courier_id")
          .eq("id", parcel.matched_trip_id)
          .single<{ courier_id: string }>();
        if (trip?.courier_id === session.user.id) hasAccess = true;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single<Pick<Profile, "role">>();
      if (profile?.role === "admin") hasAccess = true;

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Unauthorized to view ratings for this parcel" },
          { status: 403 }
        );
      }

      const { data: ratings, error } = await adminClient
        .from("ratings")
        .select("id, rater_id, rated_id, rating, review_text, created_at")
        .eq("parcel_id", parcelId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Ratings fetch error:", error);
        return NextResponse.json(
          { error: "Failed to fetch ratings" },
          { status: 500 }
        );
      }

      const raterIds = Array.from(
        new Set((ratings || []).map((r: { rater_id: string }) => r.rater_id))
      );
      const raterProfiles =
        raterIds.length > 0
          ? await adminClient
              .from("profiles")
              .select("id, full_name")
              .in("id", raterIds)
          : { data: [] };
      const raterMap = new Map(
        (raterProfiles.data || []).map(
          (p: { id: string; full_name: string | null }) => [
            p.id,
            p.full_name ?? "Anonymous",
          ]
        )
      );

      type RatingRow = {
        id: string;
        rater_id: string;
        rated_id: string;
        rating: number;
        review_text: string | null;
        created_at: string;
      };
      const list = (ratings || []).map((r: RatingRow) => ({
        id: r.id,
        rater_id: r.rater_id,
        rated_id: r.rated_id,
        rating: r.rating,
        review_text: r.review_text,
        created_at: r.created_at,
        rater_name: raterMap.get(r.rater_id) ?? "Anonymous",
      }));

      const userHasRated = list.some((r) => r.rater_id === session.user.id);

      return NextResponse.json({
        success: true,
        ratings: list,
        userHasRated,
      });
    }

    if (userId) {
      // Get ratings received by a user (for profile display)
      const adminClient = createSupabaseAdminClient();
      const { data: ratings, error } = await adminClient
        .from("ratings")
        .select(
          "id, rater_id, rated_id, rating, review_text, created_at, parcel_id"
        )
        .eq("rated_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Ratings fetch error:", error);
        return NextResponse.json(
          { error: "Failed to fetch ratings" },
          { status: 500 }
        );
      }

      const raterIds = Array.from(
        new Set((ratings || []).map((r: { rater_id: string }) => r.rater_id))
      );
      const raterProfiles =
        raterIds.length > 0
          ? await adminClient
              .from("profiles")
              .select("id, full_name")
              .in("id", raterIds)
          : { data: [] };
      const raterMap = new Map(
        (raterProfiles.data || []).map(
          (p: { id: string; full_name: string | null }) => [
            p.id,
            p.full_name ?? "Anonymous",
          ]
        )
      );

      type RatingRow2 = {
        id: string;
        rater_id: string;
        rating: number;
        review_text: string | null;
        created_at: string;
      };
      const list = (ratings || []).map((r: RatingRow2) => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        created_at: r.created_at,
        rater_name: raterMap.get(r.rater_id) ?? "Anonymous",
      }));

      const avg =
        list.length > 0
          ? list.reduce((s, r) => s + r.rating, 0) / list.length
          : null;
      const count = list.length;

      return NextResponse.json({
        success: true,
        ratings: list,
        averageRating: avg ? Math.round(avg * 10) / 10 : null,
        totalCount: count,
      });
    }

    return NextResponse.json(
      { error: "Provide parcel_id or user_id" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("GET /api/ratings error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ratings
 * Create a rating. Body: { parcel_id, rated_id, rating (1-5), review_text? }
 * Caller must be sender or courier for the parcel, and parcel must be delivered.
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
    const { parcel_id, rated_id, rating, review_text } = body;

    if (!parcel_id || !rated_id || rating == null) {
      return NextResponse.json(
        { error: "parcel_id, rated_id, and rating (1-5) are required" },
        { status: 400 }
      );
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer from 1 to 5" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: parcel, error: parcelErr } = await adminClient
      .from("parcels")
      .select("id, sender_id, matched_trip_id, status")
      .eq("id", parcel_id)
      .single<{
        id: string;
        sender_id: string;
        matched_trip_id: string | null;
        status: string;
      }>();

    if (parcelErr || !parcel) {
      return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
    }

    if (parcel.status !== "delivered") {
      return NextResponse.json(
        { error: "You can only rate after the parcel is delivered" },
        { status: 400 }
      );
    }

    if (!parcel.matched_trip_id) {
      return NextResponse.json(
        { error: "Parcel has no matched trip" },
        { status: 400 }
      );
    }

    const { data: trip } = await adminClient
      .from("trips")
      .select("courier_id")
      .eq("id", parcel.matched_trip_id)
      .single<{ courier_id: string }>();

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const isSender = parcel.sender_id === session.user.id;
    const isCourier = trip.courier_id === session.user.id;

    if (!isSender && !isCourier) {
      return NextResponse.json(
        { error: "Only the sender or courier can rate this delivery" },
        { status: 403 }
      );
    }

    if (rated_id !== parcel.sender_id && rated_id !== trip.courier_id) {
      return NextResponse.json(
        { error: "You can only rate the sender or courier of this parcel" },
        { status: 400 }
      );
    }

    if (rated_id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot rate yourself" },
        { status: 400 }
      );
    }

    if (isSender && rated_id !== trip.courier_id) {
      return NextResponse.json(
        { error: "Sender can only rate the courier" },
        { status: 400 }
      );
    }
    if (isCourier && rated_id !== parcel.sender_id) {
      return NextResponse.json(
        { error: "Courier can only rate the sender" },
        { status: 400 }
      );
    }

    const { data: acceptedMatch } = await adminClient
      .from("parcel_trip_matches")
      .select("id")
      .eq("parcel_id", parcel_id)
      .eq("trip_id", parcel.matched_trip_id)
      .eq("status", "accepted")
      .maybeSingle<{ id: string }>();

    // Fallback for legacy/inconsistent rows where the accepted flag is missing
    // but parcel->trip linkage is valid and delivered.
    let matchId = acceptedMatch?.id;
    if (!matchId) {
      const { data: fallbackMatch } = await adminClient
        .from("parcel_trip_matches")
        .select("id")
        .eq("parcel_id", parcel_id)
        .eq("trip_id", parcel.matched_trip_id)
        .order("matched_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();
      matchId = fallbackMatch?.id;
    }

    if (!matchId) {
      return NextResponse.json(
        { error: "Match not found for this parcel and trip" },
        { status: 404 }
      );
    }

    const { data: existing } = await adminClient
      .from("ratings")
      .select("id")
      .eq("parcel_id", parcel_id)
      .eq("rater_id", session.user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You have already rated this delivery" },
        { status: 400 }
      );
    }

    const ratingsTable = adminClient.from("ratings");
    const insertPayload = {
      parcel_id,
      match_id: matchId,
      rater_id: session.user.id,
      rated_id,
      rating: ratingNum,
      review_text: review_text?.trim() || null,
    };
    const { data: newRating, error: insertErr } = await (
      ratingsTable as unknown as {
        insert: (d: typeof insertPayload) => {
          select: () => {
            single: () => Promise<{
              data: unknown;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error("Rating insert error:", insertErr);
      if ((insertErr as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "You have already rated this delivery" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error:
            (insertErr as { message?: string }).message ||
            "Failed to save rating",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rating: newRating,
    });
  } catch (error: any) {
    console.error("POST /api/ratings error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
