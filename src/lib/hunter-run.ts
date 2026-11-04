import "server-only";
import type { HunterEmail } from "@/lib/hunter";
import { type HunterAccountInfo, readHunterAccount } from "@/lib/own-contacts";

// Calls Hunter.io's Domain Search (https://hunter.io/api-documentation/v2#domain-search)
// with the platform's key in HUNTER_API_KEY, or with a customer account's own
// key (see own-contacts-run.ts). Each search that finds addresses uses one of
// that Hunter account's monthly credits. Without a key Hunter is never asked.

const TIMEOUT_MS = 20_000;

export const isHunterConfigured = () => Boolean(process.env.HUNTER_API_KEY);

/** Hunter turned the key away or the credits are used up: every further search would fail too. */
export class HunterStopError extends Error {}

type HunterResponse = {
  data?: { emails?: HunterEmail[] };
  errors?: { id?: string; code?: number; details?: string }[];
};

/**
 * The email addresses Hunter knows for the domain, with names and positions.
 * `ownKey` is a customer account's own key; without it the platform's key is used.
 */
export async function hunterDomainSearch(domain: string, ownKey?: string): Promise<HunterEmail[]> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", ownKey ?? process.env.HUNTER_API_KEY ?? "");
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as HunterResponse;
  if (res.ok) return body.data?.emails ?? [];
  const details = body.errors?.[0]?.details?.slice(0, 200);
  if (res.status === 401) {
    throw new HunterStopError(
      ownKey
        ? "Your Hunter.io key is no longer valid. An owner or admin can connect it again on Company profile."
        : "The Hunter.io key (HUNTER_API_KEY) is not valid.",
    );
  }
  if (res.status === 402 || res.status === 403 || res.status === 429) {
    throw new HunterStopError(`Hunter.io stopped: ${details ?? "the monthly credits are used up"}. Upgrade or wait for next month at hunter.io.`);
  }
  // E.g. 400 for a domain Hunter cannot search; only this exhibitor is affected.
  throw new Error(`Hunter.io answered with error ${res.status}${details ? `: ${details}` : ""}.`);
}

/**
 * The Hunter account behind a key, with this month's credits. Free: it uses no
 * credits. Null when Hunter turns the key away.
 */
export async function hunterAccount(key: string): Promise<HunterAccountInfo | null> {
  const url = new URL("https://api.hunter.io/v2/account");
  url.searchParams.set("api_key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (res.status === 401 || res.status === 403) return null;
  const body = (await res.json().catch(() => ({}))) as { data?: Parameters<typeof readHunterAccount>[0] };
  if (!res.ok || !body.data) throw new Error(`Hunter.io answered with error ${res.status}. Try again in a moment.`);
  return readHunterAccount(body.data);
}
