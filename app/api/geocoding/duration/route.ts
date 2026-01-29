import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/geocoding/duration
 * Returns estimated driving duration (best case) from origin to destination using Google Directions API.
 * Query: origin_lat, origin_lng, dest_lat, dest_lng
 * Response: { durationSeconds, durationText } or error.
 * Use this to suggest realistic trip times and enforce minimum duration (anti-spam).
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Travel time estimation not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const originLat = searchParams.get("origin_lat");
    const originLng = searchParams.get("origin_lng");
    const destLat = searchParams.get("dest_lat");
    const destLng = searchParams.get("dest_lng");

    if (
      originLat == null ||
      originLng == null ||
      destLat == null ||
      destLng == null
    ) {
      return NextResponse.json(
        { error: "origin_lat, origin_lng, dest_lat, dest_lng are required" },
        { status: 400 }
      );
    }

    const olat = parseFloat(originLat);
    const olng = parseFloat(originLng);
    const dlat = parseFloat(destLat);
    const dlng = parseFloat(destLng);

    if (
      Number.isNaN(olat) ||
      Number.isNaN(olng) ||
      Number.isNaN(dlat) ||
      Number.isNaN(dlng)
    ) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    const origin = `${olat},${olng}`;
    const destination = `${dlat},${dlng}`;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch travel time" },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) {
      return NextResponse.json(
        {
          error:
            data.status === "ZERO_RESULTS"
              ? "No route found between origin and destination"
              : "Could not estimate travel time",
        },
        { status: 200 }
      );
    }

    const leg = data.routes[0].legs[0];
    const durationSeconds = leg.duration?.value ?? 0;
    const durationText = leg.duration?.text ?? "";

    return NextResponse.json({
      durationSeconds: Math.round(durationSeconds),
      durationText: durationText || formatDuration(durationSeconds),
    });
  } catch (error) {
    console.error("[GEOCODING DURATION] Error:", error);
    return NextResponse.json(
      { error: "Unexpected error estimating travel time" },
      { status: 500 }
    );
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
