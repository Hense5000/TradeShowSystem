// ISO 3166-1 alpha-2 country codes (plus Kosovo, XK, which Stripe also uses).
// Names come from the runtime (Intl), so we do not maintain translations.
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE",
  "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD",
  "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
  "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
  "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME",
  "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
  "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI",
  "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK",
  "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const CODES = new Set<string>(COUNTRY_CODES);
const names = new Intl.DisplayNames(["en"], { type: "region" });

export function isCountryCode(value: string): value is CountryCode {
  return CODES.has(value);
}

export function countryName(code: string): string {
  return names.of(code) ?? code;
}

/** All countries as select options, sorted by English name. */
export function countryOptions(): { code: CountryCode; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

const ALIASES: Record<string, CountryCode> = {
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  usa: "US",
  "united states of america": "US",
  uae: "AE",
  "south korea": "KR",
  korea: "KR",
  russia: "RU",
  "czech republic": "CZ",
  turkey: "TR",
  holland: "NL",
};

let byName: Map<string, CountryCode> | undefined;

/** A country code from a code ("de") or an English name ("Germany"), or null. */
export function findCountryCode(value: string): CountryCode | null {
  const v = value.trim();
  if (!v) return null;
  if (isCountryCode(v.toUpperCase())) return v.toUpperCase() as CountryCode;
  byName ??= new Map(COUNTRY_CODES.map((code) => [countryName(code).toLowerCase(), code]));
  const key = v.toLowerCase();
  return byName.get(key) ?? ALIASES[key] ?? null;
}
