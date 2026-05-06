/**
 * Stripe Connect Express country handling.
 *
 * `profile.country` in our DB is stored as a free-form string coming from
 * Mapbox (e.g. "United States", "Pakistan", "Zimbabwe") — not as an ISO-2
 * code. Stripe `accounts.create({ type: "express", country })` requires an
 * ISO-2 code AND that the country be in Stripe's Express-supported list.
 *
 * This helper:
 *   1. Normalises the input (full name OR ISO-2) to an ISO-2 code.
 *   2. Validates against the current Express-supported country list.
 *   3. Falls back to "US" when the country isn't supported, so couriers in
 *      unsupported regions can still onboard (they'll be paid out to a US
 *      bank account / verification info, which Stripe's Express flow handles).
 *
 * If a country is added/removed by Stripe, update EXPRESS_SUPPORTED_COUNTRIES
 * below. Source of truth:
 *   https://stripe.com/global
 *   https://docs.stripe.com/connect/express-accounts
 */

export const EXPRESS_SUPPORTED_COUNTRIES = new Set<string>([
  // North America
  "US",
  "CA",
  "MX",
  // South America
  "BR",
  // Europe (EEA + UK + CH + GI + LI)
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GI",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "CH",
  "GB",
  // Asia-Pacific
  "AU",
  "HK",
  "IN",
  "JP",
  "MY",
  "NZ",
  "SG",
  "TH",
  // Middle East
  "AE",
]);

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  // Common variants only — extend as needed.
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  america: "US",
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  ireland: "IE",
  france: "FR",
  germany: "DE",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  "the netherlands": "NL",
  belgium: "BE",
  austria: "AT",
  switzerland: "CH",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  poland: "PL",
  portugal: "PT",
  greece: "GR",
  "czech republic": "CZ",
  czechia: "CZ",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  croatia: "HR",
  cyprus: "CY",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  luxembourg: "LU",
  malta: "MT",
  slovakia: "SK",
  slovenia: "SI",
  liechtenstein: "LI",
  gibraltar: "GI",
  australia: "AU",
  "new zealand": "NZ",
  singapore: "SG",
  "hong kong": "HK",
  japan: "JP",
  india: "IN",
  malaysia: "MY",
  thailand: "TH",
  "united arab emirates": "AE",
  uae: "AE",
};

const FALLBACK_COUNTRY = "US";

export interface ResolvedExpressCountry {
  /** ISO-2 country code that is safe to pass to Stripe `accounts.create`. */
  country: string;
  /** True if we couldn't resolve / the country isn't Express-supported and we used the fallback. */
  fellBack: boolean;
  /** The raw input we tried to resolve, useful for logs. */
  originalInput: string;
}

/**
 * Resolve a free-form country string (full name, ISO-2, or empty) to an
 * Express-supported ISO-2 code, falling back to {@link FALLBACK_COUNTRY}.
 */
export function resolveExpressCountry(
  input: string | null | undefined
): ResolvedExpressCountry {
  const originalInput = (input ?? "").trim();
  if (!originalInput) {
    return {
      country: FALLBACK_COUNTRY,
      fellBack: true,
      originalInput,
    };
  }

  const normalised = originalInput.toLowerCase();

  // Direct ISO-2 match (e.g. "us", "GB").
  if (originalInput.length === 2) {
    const candidate = originalInput.toUpperCase();
    if (EXPRESS_SUPPORTED_COUNTRIES.has(candidate)) {
      return { country: candidate, fellBack: false, originalInput };
    }
    return {
      country: FALLBACK_COUNTRY,
      fellBack: true,
      originalInput,
    };
  }

  // Full-name lookup.
  const mapped = COUNTRY_NAME_TO_ISO2[normalised];
  if (mapped && EXPRESS_SUPPORTED_COUNTRIES.has(mapped)) {
    return { country: mapped, fellBack: false, originalInput };
  }

  return {
    country: FALLBACK_COUNTRY,
    fellBack: true,
    originalInput,
  };
}
