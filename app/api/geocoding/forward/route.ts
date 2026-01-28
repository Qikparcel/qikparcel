import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface GoogleGeocodeResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

interface GooglePlaceDetails {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

// Helper to extract a component by type from Google address_components
function getComponent(
  components: GoogleGeocodeResult["address_components"] | GooglePlaceDetails["address_components"],
  types: string[]
): string {
  const comp = components.find((c) => types.some((t) => c.types.includes(t)));
  return comp ? comp.long_name : "";
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error(
        "[GEOCODING] Missing GOOGLE_MAPS_API_KEY environment variable"
      );
      return NextResponse.json(
        { error: "Server geocoding not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const limitParam = searchParams.get("limit");
    const countryParam = searchParams.get("country"); // optional ISO country code, e.g. "ZW"
    const limit = Math.min(
      Math.max(Number(limitParam) || 5, 1),
      10 // hard cap to 10 results
    );

    if (!query.trim() || query.trim().length < 3) {
      return NextResponse.json({ features: [] }, { status: 200 });
    }

    const encodedQuery = encodeURIComponent(query.trim());

    // Use Places Autocomplete API for suggestions (limit > 1) - returns more results
    // Use Geocoding API for final geocoding (limit === 1) - more accurate for complete addresses
    const isSuggestions = limit > 1;

    if (isSuggestions) {
      // Use Places Autocomplete API for better suggestion results
      const componentsParam = countryParam
        ? `&components=country:${encodeURIComponent(countryParam.toUpperCase())}`
        : "";
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}${componentsParam}&key=${apiKey}`;

      console.log("[GEOCODING] Requesting Google Places Autocomplete", {
        query,
        limit,
        country: countryParam || null,
        url: `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}${componentsParam}&key=HIDDEN`,
      });

      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error(
          "[GEOCODING] Google Places Autocomplete HTTP error:",
          res.status,
          text
        );
        return NextResponse.json(
          { error: "Failed to fetch address suggestions" },
          { status: 500 }
        );
      }

      const autocompleteData = await res.json();

      console.log("[GEOCODING] Google Places Autocomplete response:", {
        status: autocompleteData.status,
        error_message: autocompleteData.error_message,
        predictionsCount: Array.isArray(autocompleteData.predictions)
          ? autocompleteData.predictions.length
          : 0,
      });

      if (
        autocompleteData.status !== "OK" ||
        !Array.isArray(autocompleteData.predictions)
      ) {
        console.warn(
          "[GEOCODING] Google Places Autocomplete non-OK status:",
          autocompleteData.status,
          autocompleteData.error_message
        );
        return NextResponse.json({ features: [] }, { status: 200 });
      }

      const predictions: GooglePlacePrediction[] = autocompleteData.predictions.slice(
        0,
        limit
      );

      // Fetch place details for each prediction to get coordinates and full address
      const featuresPromises = predictions.map(async (prediction) => {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=place_id,formatted_address,geometry,address_components&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        if (!detailsRes.ok) {
          console.warn(
            `[GEOCODING] Failed to fetch details for place_id: ${prediction.place_id}`
          );
          return null;
        }
        const detailsData = await detailsRes.json();
        if (detailsData.status !== "OK" || !detailsData.result) {
          console.warn(
            `[GEOCODING] Places Details API returned non-OK status: ${detailsData.status} for place_id: ${prediction.place_id}`
          );
          return null;
        }
        
        const result = detailsData.result as GooglePlaceDetails;
        
        // Verify geometry and coordinates exist
        if (!result.geometry || !result.geometry.location) {
          console.error(
            `[GEOCODING] ⚠️ Missing geometry.location for place_id: ${prediction.place_id}`,
            JSON.stringify(result, null, 2)
          );
          return null;
        }
        
        const lat = result.geometry.location.lat;
        const lng = result.geometry.location.lng;
        
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          console.error(
            `[GEOCODING] ⚠️ Invalid coordinates for place_id: ${prediction.place_id}`,
            { lat, lng, latType: typeof lat, lngType: typeof lng }
          );
          return null;
        }
        
        console.log(
          `[GEOCODING] ✅ Place details fetched: ${result.formatted_address} | Coordinates: ${lat}, ${lng}`
        );
        
        return result;
      });

      const placeDetailsResults = await Promise.all(featuresPromises);
      const results = placeDetailsResults.filter(
        (r): r is GooglePlaceDetails => r !== null
      );

      console.log(
        `[GEOCODING] Fetched ${results.length} place details from ${predictions.length} predictions`
      );

      // Map to features format
      const features = results.map((result) => {
        const components = result.address_components;

        const city =
          getComponent(components, ["locality", "postal_town"]) ||
          getComponent(components, [
            "administrative_area_level_2",
            "administrative_area_level_3",
          ]);

        const state = getComponent(components, ["administrative_area_level_1"]);
        const postcode = getComponent(components, ["postal_code"]);
        const country = getComponent(components, ["country"]);
        const streetNumber = getComponent(components, ["street_number"]);
        const route = getComponent(components, ["route"]);
        const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

        // Extract coordinates with verification
        const lat = result.geometry.location.lat;
        const lng = result.geometry.location.lng;
        
        // Final verification before returning
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          console.error(
            `[GEOCODING] ⚠️ CRITICAL: Invalid coordinates in mapping step for place_id: ${result.place_id}`,
            { lat, lng }
          );
          // Don't return this feature if coordinates are invalid
          return null;
        }

        return {
          id: result.place_id,
          geometry: {
            type: "Point",
            coordinates: [lng, lat], // [longitude, latitude] format
          },
          properties: {
            mapbox_id: result.place_id,
            feature_type: streetAddress ? "address" : "place",
            full_address: result.formatted_address,
            name: streetAddress || result.formatted_address,
            name_preferred: streetAddress || result.formatted_address,
            place_formatted: result.formatted_address,
            coordinates: {
              longitude: lng,
              latitude: lat,
            },
            context: {
              region: state ? { name: state, region_code: "" } : undefined,
              country: country ? { name: country, country_code: "" } : undefined,
              place: city ? { name: city } : undefined,
              locality: city ? { name: city } : undefined,
              postcode: postcode ? { name: postcode } : undefined,
              street: route ? { name: route } : undefined,
              address: streetAddress
                ? {
                    name: streetAddress,
                    address_number: streetNumber || "",
                  }
                : undefined,
            },
          },
        };
      }).filter((f): f is NonNullable<typeof f> => f !== null); // Remove any null entries

      console.log(
        `[GEOCODING] ✅ Returning ${features.length} features with coordinates`
      );
      
      // Log first feature's coordinates as verification
      if (features.length > 0) {
        const firstFeature = features[0];
        console.log(
          `[GEOCODING] Sample feature coordinates: lat=${firstFeature.properties.coordinates.latitude}, lng=${firstFeature.properties.coordinates.longitude}`
        );
      }

      return NextResponse.json({ features }, { status: 200 });
    } else {
      // Use Geocoding API for final geocoding (limit === 1)
      const componentsParam = countryParam
        ? `&components=country:${encodeURIComponent(countryParam.toUpperCase())}`
        : "";
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}${componentsParam}&key=${apiKey}`;

      console.log("[GEOCODING] Requesting Google Geocoding", {
        query,
        limit,
        country: countryParam || null,
        url: `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}${componentsParam}&key=HIDDEN`,
      });

      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error(
          "[GEOCODING] Google Geocoding HTTP error:",
          res.status,
          text
        );
        return NextResponse.json(
          { error: "Failed to fetch geocoding results" },
          { status: 500 }
        );
      }

      const data = await res.json();

      console.log("[GEOCODING] Google response status:", {
        status: data.status,
        error_message: data.error_message,
        resultsCount: Array.isArray(data.results) ? data.results.length : 0,
      });

      if (data.status !== "OK" || !Array.isArray(data.results)) {
        console.warn(
          "[GEOCODING] Google Geocoding non-OK status:",
          data.status,
          data.error_message
        );
        return NextResponse.json({ features: [] }, { status: 200 });
      }

      const results: GoogleGeocodeResult[] = data.results.slice(0, limit);

    // Shape the response to look similar to the Mapbox v6 "features" structure
    const features = results.map((result) => {
      const components = result.address_components;

      const city =
        getComponent(components, ["locality", "postal_town"]) ||
        getComponent(components, [
          "administrative_area_level_2",
          "administrative_area_level_3",
        ]);

      const state = getComponent(components, ["administrative_area_level_1"]);
      const postcode = getComponent(components, ["postal_code"]);
      const country = getComponent(components, ["country"]);
      const streetNumber = getComponent(components, ["street_number"]);
      const route = getComponent(components, ["route"]);
      const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

      // Verify geometry exists
      if (!result.geometry || !result.geometry.location) {
        console.error(
          `[GEOCODING] ⚠️ Missing geometry.location in Geocoding API result for place_id: ${result.place_id}`
        );
        return null;
      }

      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;

      // Verify coordinates are valid numbers
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        console.error(
          `[GEOCODING] ⚠️ Invalid coordinates in Geocoding API result for place_id: ${result.place_id}`,
          { lat, lng }
        );
        return null;
      }

      console.log(
        `[GEOCODING] ✅ Geocoding API result: ${result.formatted_address} | Coordinates: ${lat}, ${lng}`
      );

      return {
        id: result.place_id,
        geometry: {
          type: "Point",
          coordinates: [lng, lat], // [longitude, latitude] format
        },
        properties: {
          mapbox_id: result.place_id, // kept for compatibility with existing type
          feature_type: streetAddress ? "address" : "place",
          full_address: result.formatted_address,
          name: streetAddress || result.formatted_address,
          name_preferred: streetAddress || result.formatted_address,
          place_formatted: result.formatted_address,
          coordinates: {
            longitude: lng,
            latitude: lat,
          },
          context: {
            region: state ? { name: state, region_code: "" } : undefined,
            country: country ? { name: country, country_code: "" } : undefined,
            place: city ? { name: city } : undefined,
            locality: city ? { name: city } : undefined,
            postcode: postcode ? { name: postcode } : undefined,
            street: route ? { name: route } : undefined,
            address: streetAddress
              ? {
                  name: streetAddress,
                  address_number: streetNumber || "",
                }
              : undefined,
          },
          },
        };
      }).filter((f): f is NonNullable<typeof f> => f !== null); // Remove any null entries

      console.log(
        `[GEOCODING] ✅ Geocoding API returning ${features.length} features with coordinates`
      );

      return NextResponse.json(
        {
          features,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("[GEOCODING] Unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected error during geocoding" },
      { status: 500 }
    );
  }
}

