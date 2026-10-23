import type { Currency } from "@prisma/client";

// The value of the project with a favorite exhibitor, shown in the currency
// the account picks on its Company profile.

export const CURRENCIES = ["EUR", "USD", "GBP"] as const satisfies readonly Currency[];

export const CURRENCY_LABEL: Record<Currency, string> = {
  EUR: "EUR (€)",
  USD: "USD ($)",
  GBP: "GBP (£)",
};

export const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: "€", USD: "$", GBP: "£" };

// Fits the database column (a 32-bit integer).
export const MAX_PROJECT_VALUE = 2_000_000_000;

export function parseCurrency(value: unknown): Currency | undefined {
  return CURRENCIES.find((c) => c === value);
}

/**
 * The value typed in the field, in whole units, or null when it is empty.
 * Takes "12500", "12,500", "12.500", "12 500" and "€12,500.50" (cents are rounded off).
 */
export function parseProjectValue(value: unknown): { value: number | null; error?: undefined } | { error: string } {
  let text = (typeof value === "string" ? value : "").replace(/[\s€$£]|EUR|USD|GBP/gi, "");
  if (!text) return { value: null };
  // A separator followed by one or two digits at the end is a decimal point;
  // with three digits it is a thousands separator.
  const decimals = /[.,](\d{1,2})$/.exec(text);
  let cents = 0;
  if (decimals) {
    cents = Number(decimals[1].padEnd(2, "0"));
    text = text.slice(0, decimals.index);
  }
  if (!/^\d{1,3}([.,]?\d{3})*$|^\d+$/.test(text)) return { error: "Enter an amount, e.g. 25000." };
  const whole = Number(text.replace(/[.,]/g, "")) + (cents >= 50 ? 1 : 0);
  if (whole > MAX_PROJECT_VALUE) return { error: "That amount is too large." };
  return { value: whole };
}

/** "€12,500", "$0" or "£1,200,000". */
export function formatMoney(value: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

/** The value as it stands in the field: "12,500", or "" when none is set. */
export function projectValueText(value: number | null): string {
  return value === null ? "" : value.toLocaleString("en-US");
}
