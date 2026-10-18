// The same company at several trade shows. Each show has its own Exhibitor
// row; rows with the same company key are shown as one company.
//
// Matching rule: two rows are the same company when their websites have the
// same domain (www., http(s) and paths ignored). A row without a usable
// website joins the company whose name it shares, when exactly one domain
// goes with that name; otherwise rows match on the normalized name (case,
// accents, punctuation and endings like GmbH, Ltd or A/S ignored).

// Sites that host many companies' pages, so their domain says nothing about the company.
const SHARED_HOSTS = new Set([
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "google.com",
  "wixsite.com",
  "wordpress.com",
  "blogspot.com",
  "weebly.com",
  "jimdo.com",
  "jimdosite.com",
  "squarespace.com",
  "business.site",
  "alibaba.com",
  "made-in-china.com",
  "linktr.ee",
]);

// Second-level labels under a country code, e.g. co.uk or com.au, where the company name is one label further left.
const COUNTRY_SECOND_LEVELS = new Set(["co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc", "ne", "or", "gen", "biz"]);

/** The company's domain from its website, e.g. "acme.com" from "https://www.shop.acme.com/en", or null when there is none to go by. */
export function companyDomain(website: string | null | undefined): string | null {
  const text = website?.trim();
  if (!text) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "");
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1])) return null;
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const keep = tld.length === 2 && COUNTRY_SECOND_LEVELS.has(second) && labels.length >= 3 ? 3 : 2;
  const domain = labels.slice(-keep).join(".");
  return SHARED_HOSTS.has(domain) ? null : domain;
}

// Company form endings, compared after punctuation is removed ("A/S" becomes "as", "S.p.A." becomes "spa").
const LEGAL_ENDINGS = new Set([
  "gmbh", "mbh", "ag", "kg", "ohg", "ug", "ev", "co", "cokg", "kgaa",
  "ltd", "limited", "plc", "llp", "llc", "inc", "incorporated", "corp", "corporation", "company", "lp",
  "as", "aps", "asa", "ab", "oy", "oyj", "ehf", "hf", "is",
  "bv", "nv", "bvba", "sa", "sas", "sarl", "sasu", "srl", "spa", "sl", "slu", "sro", "spzoo", "zoo", "sp", "kft", "ou", "uab", "doo", "ad",
  "pty", "pvt", "private", "bhd", "sdn", "pte", "kk", "group", "holding", "holdings",
]);

/** The company name as it is compared: lower case, without accents, punctuation, a leading "the" or a legal ending. */
export function normalizeCompanyName(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b([a-z])[./]\s*(?=[a-z]\b)/g, "$1") // A/S, S.p.A., e.V. → as, spa, ev
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words[0] === "the" && words.length > 1) words.shift();
  // Drop endings like "GmbH & Co. KG", but never the whole name.
  while (words.length > 1 && (LEGAL_ENDINGS.has(words[words.length - 1]) || (words[words.length - 1] === "and" && words.length > 2))) {
    words.pop();
  }
  return words.join(" ");
}

export type CompanyRow = { id: string; name: string; website: string | null };

/** The company key of every row, by id. Rows with the same key are the same company. */
export function companyKeys(rows: CompanyRow[]): Map<string, string> {
  const parsed = rows.map((r) => ({ id: r.id, domain: companyDomain(r.website), name: normalizeCompanyName(r.name) }));

  // The domains seen with each name, so a row without a website can join the company that has one.
  const domainsByName = new Map<string, Set<string>>();
  for (const r of parsed) {
    if (!r.domain || !r.name) continue;
    const set = domainsByName.get(r.name) ?? new Set<string>();
    set.add(r.domain);
    domainsByName.set(r.name, set);
  }

  const keys = new Map<string, string>();
  for (const r of parsed) {
    if (r.domain) {
      keys.set(r.id, r.domain);
      continue;
    }
    const domains = domainsByName.get(r.name);
    keys.set(r.id, domains?.size === 1 ? [...domains][0] : r.name ? `name:${r.name}` : `id:${r.id}`);
  }
  return keys;
}

type ShowRow = { id: string; tradeShow: { id: string } };

/**
 * One company on the Exhibitors page, from all its rows sorted latest trade
 * show first. `main` is the row the page shows (the latest one the filters
 * match); empty details are taken from the company's other rows.
 */
export function summarizeCompany<R extends ShowRow & Record<string, unknown>>(rows: R[], matches: (row: R) => boolean = () => true) {
  const main = rows.find(matches) ?? rows[0];
  const first = <K extends keyof R>(field: K): R[K] | null => {
    if (main[field] != null && main[field] !== "") return main[field];
    return rows.find((r) => r[field] != null && r[field] !== "")?.[field] ?? null;
  };
  const contact = [main, ...rows].find((r) => r.contactName || r.email) ?? main;
  const shows = rows.filter((r, i) => rows.findIndex((o) => o.tradeShow.id === r.tradeShow.id) === i).map((r) => r.tradeShow as R["tradeShow"]);
  return { main, contact, first, shows, ids: rows.map((r) => r.id) };
}
