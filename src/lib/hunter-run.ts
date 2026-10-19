import "server-only";
import type { HunterEmail } from "@/lib/hunter";

// Calls Hunter.io's Domain Search (https://hunter.io/api-documentation/v2#domain-search)
// with the key in HUNTER_API_KEY. Each search that finds addresses uses one of
// the Hunter account's monthly credits. Without the key Hunter is never asked.

const TIMEOUT_MS = 20_000;

export const isHunterConfigured = () => Boolean(process.env.HUNTER_API_KEY);

/** Hunter turned the key away or the credits are used up: every further search would fail too. */
export class HunterStopError extends Error {}

type HunterResponse = {
  data?: { emails?: HunterEmail[] };
  errors?: { id?: string; code?: number; details?: string }[];
};

/** The email addresses Hunter knows for the domain, with names and positions. */
export async function hunterDomainSearch(domain: string): Promise<HunterEmail[]> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", process.env.HUNTER_API_KEY ?? "");
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as HunterResponse;
  if (res.ok) return body.data?.emails ?? [];
  const details = body.errors?.[0]?.details?.slice(0, 200);
  if (res.status === 401) throw new HunterStopError("The Hunter.io key (HUNTER_API_KEY) is not valid.");
  if (res.status === 402 || res.status === 403 || res.status === 429) {
    throw new HunterStopError(`Hunter.io stopped: ${details ?? "the monthly credits are used up"}. Upgrade or wait for next month at hunter.io.`);
  }
  // E.g. 400 for a domain Hunter cannot search; only this exhibitor is affected.
  throw new Error(`Hunter.io answered with error ${res.status}${details ? `: ${details}` : ""}.`);
}
