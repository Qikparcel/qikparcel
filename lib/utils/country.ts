/**
 * Country name to ISO 3166-1 alpha-2 code mapping for pricing
 * Used when addresses return country names (e.g. from Google) but pricing uses codes
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  zimbabwe: "ZW",
  "south africa": "ZA",
  "united kingdom": "GB",
  uk: "GB",
  "united states": "US",
  usa: "US",
  america: "US",
  "united arab emirates": "AE",
  uae: "AE",
  australia: "AU",
  germany: "DE",
  france: "FR",
  netherlands: "NL",
  kenya: "KE",
  nigeria: "NG",
  ghana: "GH",
  botswana: "BW",
  mozambique: "MZ",
  zambia: "ZM",
  malawi: "MW",
  tanzania: "TZ",
  uganda: "UG",
  canada: "CA",
  india: "IN",
  china: "CN",
  japan: "JP",
  brazil: "BR",
  mexico: "MX",
  spain: "ES",
  italy: "IT",
  portugal: "PT",
  belgium: "BE",
  switzerland: "CH",
  austria: "AT",
  poland: "PL",
  ireland: "IE",
  "new zealand": "NZ",
  singapore: "SG",
  malaysia: "MY",
  "hong kong": "HK",
  "south korea": "KR",
  thailand: "TH",
  vietnam: "VN",
  indonesia: "ID",
  philippines: "PH",
  estonia: "EE",
  egypt: "EG",
  morocco: "MA",
  "saudi arabia": "SA",
  israel: "IL",
  turkey: "TR",
  russia: "RU",
  ukraine: "UA",
  pakistan: "PK",
  bangladesh: "BD",
  "sri lanka": "LK",
  namibia: "NA",
  angola: "AO",
  "cote d'ivoire": "CI",
  "ivory coast": "CI",
  senegal: "SN",
  ethiopia: "ET",
  rwanda: "RW",
  cameroon: "CM",
  "congo (democratic republic)": "CD",
  drc: "CD",
  congo: "CG",
  "republic of congo": "CG",
};

/**
 * Normalize country to ISO code for pricing lookup
 * @param country - Country name or code from address
 * @returns ISO 3166-1 alpha-2 code (e.g. ZW, ZA) or original if not found
 */
export function countryToCode(country: string | null | undefined): string {
  if (!country || !country.trim()) return "*";
  const normalized = country.trim().toLowerCase();
  // Already a 2-letter code
  if (normalized.length === 2) return normalized.toUpperCase();
  return (
    COUNTRY_NAME_TO_CODE[normalized] ||
    normalized.toUpperCase().slice(0, 2) ||
    "*"
  );
}
