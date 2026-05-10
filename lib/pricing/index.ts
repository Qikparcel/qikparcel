/**
 * Delivery pricing: domestic (km-based) vs international (country-pair)
 */

import { calculateDistance } from "@/lib/matching/distance";
import { countryToCode } from "@/lib/utils/country";
import { SupabaseClient } from "@supabase/supabase-js";

const PLATFORM_COMMISSION_PERCENT = parseFloat(
  process.env.PLATFORM_COMMISSION_PERCENT || "15"
);

export interface PricingInput {
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupCountry: string | null;
  deliveryCountry: string | null;
  pickupCity?: string | null;
  deliveryCity?: string | null;
  parcelSize?: "small" | "medium" | "large";
}

/** Estimated delivery time: min/max in hours. Cross-border: 2 hours – 10 days; domestic: distance-based (days). */
export interface PricingResult {
  deliveryFee: number;
  platformFee: number;
  totalAmount: number;
  currency: string;
  isDomestic: boolean;
  distanceKm: number;
  /** Estimated delivery time min (hours). Cross-border: 2; domestic: from distance (days × 24). */
  estimatedDeliveryMinHours: number;
  /** Estimated delivery time max (hours). Cross-border: 10×24 = 240; domestic: same as min. */
  estimatedDeliveryMaxHours: number;
}

type ServiceTier = "economy" | "standard" | "priority";

type TierPricing = Record<ServiceTier, number>;

interface DistanceBandPricing {
  maxDistanceKm: number;
  prices: TierPricing;
}

const DOMESTIC_LOCAL_DISTANCE_BANDS: DistanceBandPricing[] = [
  { maxDistanceKm: 5, prices: { economy: 3, standard: 5, priority: 8 } },
  { maxDistanceKm: 10, prices: { economy: 4, standard: 6, priority: 10 } },
  { maxDistanceKm: 20, prices: { economy: 5, standard: 8, priority: 12 } },
];

const INTERCITY_CORRIDOR_PRICING: Record<string, Record<string, TierPricing>> = {
  ZA: {
    "johannesburg|pretoria": { economy: 5, standard: 8, priority: 15 },
    "johannesburg|durban": { economy: 12, standard: 20, priority: 35 },
    "johannesburg|cape town": { economy: 20, standard: 35, priority: 55 },
    "cape town|durban": { economy: 25, standard: 40, priority: 65 },
    "pretoria|durban": { economy: 12, standard: 20, priority: 35 },
  },
  ZW: {
    "harare|bulawayo": { economy: 7, standard: 12, priority: 20 },
    "harare|mutare": { economy: 5, standard: 10, priority: 18 },
    "harare|gweru": { economy: 5, standard: 10, priority: 18 },
    "bulawayo|gweru": { economy: 4, standard: 8, priority: 15 },
  },
  GB: {
    "london|birmingham": { economy: 12, standard: 22, priority: 40 },
    "london|manchester": { economy: 18, standard: 30, priority: 50 },
    "birmingham|manchester": { economy: 10, standard: 18, priority: 35 },
  },
};

function normalizeCity(city: string | null | undefined): string {
  if (!city) return "";
  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "");
}

function corridorKey(cityA: string, cityB: string): string {
  const [first, second] = [cityA, cityB].sort((a, b) => a.localeCompare(b));
  return `${first}|${second}`;
}

function parcelSizeToTier(size?: "small" | "medium" | "large"): ServiceTier {
  switch (size) {
    case "small":
      return "economy";
    case "large":
      return "priority";
    case "medium":
    default:
      return "standard";
  }
}

function getDomesticLocalBandPrice(
  distanceKm: number,
  tier: ServiceTier
): number | null {
  for (const band of DOMESTIC_LOCAL_DISTANCE_BANDS) {
    if (distanceKm <= band.maxDistanceKm) {
      return band.prices[tier];
    }
  }
  return null;
}

function getIntercityCorridorPrice(
  countryCode: string,
  pickupCity: string | null | undefined,
  deliveryCity: string | null | undefined,
  tier: ServiceTier
): number | null {
  const cityA = normalizeCity(pickupCity);
  const cityB = normalizeCity(deliveryCity);
  if (!cityA || !cityB || cityA === cityB) return null;

  const countryCorridors = INTERCITY_CORRIDOR_PRICING[countryCode];
  if (!countryCorridors) return null;

  const key = corridorKey(cityA, cityB);
  const corridor = countryCorridors[key];
  if (!corridor) return null;

  return corridor[tier];
}

/**
 * Get delivery pricing row for origin/destination country pair
 */
async function getPricingRow(
  supabase: SupabaseClient,
  originCountry: string,
  destCountry: string
): Promise<{
  base_fee: number;
  rate_per_km: number;
  max_distance_km: number | null;
  currency: string;
  is_domestic: boolean;
} | null> {
  type PricingRow = {
    base_fee: number;
    rate_per_km: number;
    max_distance_km: number | null;
    currency: string | null;
    is_domestic: boolean;
  };

  // Try exact pair first
  const { data: exact } = await supabase
    .from("delivery_pricing")
    .select("base_fee, rate_per_km, max_distance_km, currency, is_domestic")
    .eq("origin_country", originCountry)
    .eq("destination_country", destCountry)
    .single<PricingRow>();

  if (exact) {
    return {
      base_fee: Number(exact.base_fee),
      rate_per_km: Number(exact.rate_per_km),
      max_distance_km: exact.max_distance_km
        ? Number(exact.max_distance_km)
        : null,
      currency: exact.currency || "USD",
      is_domestic: Boolean(exact.is_domestic),
    };
  }

  // Fallback: generic domestic (*, *) for same country
  if (originCountry === destCountry) {
    const { data: fallback } = await supabase
      .from("delivery_pricing")
      .select("base_fee, rate_per_km, max_distance_km, currency, is_domestic")
      .eq("origin_country", "*")
      .eq("destination_country", "*")
      .single<PricingRow>();

    if (fallback) {
      return {
        base_fee: Number(fallback.base_fee),
        rate_per_km: Number(fallback.rate_per_km),
        max_distance_km: fallback.max_distance_km
          ? Number(fallback.max_distance_km)
          : null,
        currency: fallback.currency || "USD",
        is_domestic: true,
      };
    }
  }

  return null;
}

/**
 * Size multiplier for domestic pricing (larger parcels cost more)
 */
function getSizeMultiplier(size?: "small" | "medium" | "large"): number {
  switch (size) {
    case "small":
      return 0.9;
    case "medium":
      return 1.0;
    case "large":
      return 1.2;
    default:
      return 1.0;
  }
}

/**
 * Calculate delivery fee and platform commission
 */
export async function calculateDeliveryPricing(
  supabase: SupabaseClient,
  input: PricingInput
): Promise<PricingResult | null> {
  const originCode = countryToCode(input.pickupCountry);
  const destCode = countryToCode(input.deliveryCountry);

  const pricing = await getPricingRow(supabase, originCode, destCode);
  if (!pricing) return null;

  // Distance: use parcel pickup -> delivery (actual delivery route)
  let distanceKm = 0;
  if (
    input.pickupLat != null &&
    input.pickupLng != null &&
    input.deliveryLat != null &&
    input.deliveryLng != null
  ) {
    distanceKm = calculateDistance(
      input.pickupLat,
      input.pickupLng,
      input.deliveryLat,
      input.deliveryLng
    );
  }

  // Cap distance for international if configured
  let effectiveDistance = distanceKm;
  if (pricing.max_distance_km != null && distanceKm > pricing.max_distance_km) {
    effectiveDistance = pricing.max_distance_km;
  }

  const tier = parcelSizeToTier(input.parcelSize);
  const sizeMultiplier = getSizeMultiplier(input.parcelSize);
  let deliveryFee = Math.max(
    0,
    (pricing.base_fee + effectiveDistance * pricing.rate_per_km) *
      sizeMultiplier
  );

  if (pricing.is_domestic) {
    const corridorPrice = getIntercityCorridorPrice(
      originCode,
      input.pickupCity,
      input.deliveryCity,
      tier
    );

    if (corridorPrice != null) {
      deliveryFee = corridorPrice;
    } else {
      const localBandPrice = getDomesticLocalBandPrice(distanceKm, tier);
      if (localBandPrice != null) {
        deliveryFee = localBandPrice;
      }
    }
  }

  const platformFee =
    Math.round(((deliveryFee * PLATFORM_COMMISSION_PERCENT) / 100) * 100) / 100;
  const totalAmount = Math.round((deliveryFee + platformFee) * 100) / 100;

  // Estimated delivery time (hours): cross-border = 2 hours – 10 days; domestic = distance-based (driving)
  const KM_PER_DAY_DOMESTIC = 400; // ~400 km/day driving
  const HOURS_PER_DAY = 24;
  let estimatedDeliveryMinHours: number;
  let estimatedDeliveryMaxHours: number;
  if (pricing.is_domestic) {
    const days = Math.max(
      1,
      Math.min(7, Math.ceil(distanceKm / KM_PER_DAY_DOMESTIC))
    );
    const hours = days * HOURS_PER_DAY;
    estimatedDeliveryMinHours = hours;
    estimatedDeliveryMaxHours = hours;
  } else {
    // Cross-border (by address): min 2 hours, max 10 days (not a hard 1–2 day rule)
    estimatedDeliveryMinHours = 2;
    estimatedDeliveryMaxHours = 10 * HOURS_PER_DAY; // 10 days
  }

  return {
    deliveryFee,
    platformFee,
    totalAmount,
    currency: pricing.currency,
    isDomestic: pricing.is_domestic,
    distanceKm,
    estimatedDeliveryMinHours,
    estimatedDeliveryMaxHours,
  };
}
