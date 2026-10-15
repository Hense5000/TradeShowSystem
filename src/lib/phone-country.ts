import { type CountryCode as PhoneCountry, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import { type CountryCode, isCountryCode } from "@/lib/countries";

/**
 * The country a phone number belongs to, read from its international prefix
 * (+45 or 0045 is Denmark), or null. Numbers without a prefix are not guessed.
 */
export function countryFromPhone(phone: string | null | undefined): CountryCode | null {
  const raw = phone?.trim() ?? "";
  if (!/^(\+|00)/.test(raw)) return null;
  const international = raw.replace(/^00/, "+");
  const parsed = parsePhoneNumberFromString(international);
  const country = parsed?.country ?? onlyCountryWithPrefix(international);
  return country && isCountryCode(country) ? country : null;
}

/** The one country using the number's calling code, e.g. +45 is only Denmark; +1 and +44 are shared, so they give null. */
function onlyCountryWithPrefix(international: string): PhoneCountry | undefined {
  const digits = international.replace(/\D/g, "");
  for (let length = 1; length <= 3; length++) {
    const code = digits.slice(0, length);
    const matches = getCountries().filter((c) => getCountryCallingCode(c) === code);
    if (matches.length > 0) return matches.length === 1 ? matches[0] : undefined;
  }
  return undefined;
}

/** The exhibitor's data with the country filled in from the phone number, when the country is empty. */
export function withPhoneCountry<T extends { phone?: string | null; country?: string | null }>(e: T): T {
  if (e.country) return e;
  const country = countryFromPhone(e.phone);
  return country ? { ...e, country } : e;
}
