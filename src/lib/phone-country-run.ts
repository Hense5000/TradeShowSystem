import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { countryFromPhone } from "@/lib/phone-country";

/** Exhibitors with no country but a phone number with an international prefix, whose country may be read from it. */
const candidates: Prisma.ExhibitorWhereInput = { country: null, OR: [{ phone: { startsWith: "+" } }, { phone: { startsWith: "00" } }] };

/** How many exhibitors would get a country from their phone number. */
export async function countCountriesFromPhones(): Promise<number> {
  const rows = await db.exhibitor.findMany({ where: candidates, select: { phone: true } });
  return rows.filter((e) => countryFromPhone(e.phone)).length;
}

/** Fills the empty countries of all exhibitors from their phone numbers; returns how many were filled. */
export async function fillCountriesFromPhones(): Promise<number> {
  const rows = await db.exhibitor.findMany({ where: candidates, select: { id: true, phone: true } });
  const byCountry = new Map<string, string[]>();
  for (const e of rows) {
    const country = countryFromPhone(e.phone);
    if (country) byCountry.set(country, [...(byCountry.get(country) ?? []), e.id]);
  }
  let filled = 0;
  for (const [country, ids] of byCountry) {
    // country: null again, so a country someone picked meanwhile is kept.
    const { count } = await db.exhibitor.updateMany({ where: { id: { in: ids }, country: null }, data: { country } });
    filled += count;
  }
  return filled;
}
