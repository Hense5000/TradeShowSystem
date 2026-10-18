import { countryName } from "@/lib/countries";

// The daily email about what is new in an account's Favorites list. This file
// holds the parts that need no database, so they can be tested on their own.

/** The exhibitor details the email watches, with the label it uses for each. */
export const DIGEST_FIELDS = {
  name: "Company name",
  contactName: "Contact person",
  contactTitle: "Position",
  email: "Email",
  phone: "Phone",
  website: "Website",
  country: "Country",
  industry: "Industry",
  boothNumber: "Booth",
  standLocationUrl: "Stand location",
  companyProfile: "Company profile",
} as const;

type Field = keyof typeof DIGEST_FIELDS;
export type Snapshot = Record<Field, string | null>;
export type Change = { label: string; value: string | null };

export function exhibitorSnapshot(e: Snapshot): Snapshot {
  return Object.fromEntries(Object.keys(DIGEST_FIELDS).map((k) => [k, e[k as Field] ?? null])) as Snapshot;
}

/** What differs between the last reported details and the details now. */
export function changedFields(before: Partial<Snapshot>, now: Snapshot): Change[] {
  return (Object.keys(DIGEST_FIELDS) as Field[])
    .filter((k) => (before[k] ?? null) !== (now[k] ?? null))
    .map((k) => ({ label: DIGEST_FIELDS[k], value: k === "country" && now[k] ? countryName(now[k]) : now[k] }));
}

/** One exhibitor in the email: the lists it is on, who added it and what changed. */
export type DigestEntry = {
  exhibitor: string;
  tradeShow: string;
  lists: string[];
  addedBy?: string; // set when someone else put it on a list since the last email
  changes: Change[];
};

/** A follow-up reminder that is due today or overdue. */
export type DigestFollowUp = {
  exhibitor: string;
  tradeShow: string;
  due: string; // e.g. "Today" or "Overdue · Oct 15"
  note: string | null;
};

/** A new exhibitor at a favorite trade show that looks like the account's favorites. */
export type DigestSuggestion = {
  exhibitor: string;
  tradeShow: string;
  why: string; // e.g. "Medical devices · Germany", what it shares with the favorites
  url: string; // the exhibitor on the Exhibitors page, where it can be starred
};

/** At most this many suggestions are listed in one email; the rest are only counted. */
export const MAX_SUGGESTIONS = 10;

type Profile = { name: string; industry: string | null; country: string | null; companyKey: string | null };
const norm = (s: string | null) => s?.trim().toLowerCase() || "";

/**
 * The candidates that share an industry or a country with the starred
 * exhibitors, best first: industry and country, then industry, then country.
 * Companies that are already starred (at any show) are left out.
 */
export function similarExhibitors<T extends Profile>(starred: Profile[], candidates: T[]): { exhibitor: T; why: string }[] {
  const industries = new Set(starred.map((e) => norm(e.industry)).filter(Boolean));
  const countries = new Set(starred.map((e) => norm(e.country)).filter(Boolean));
  const keys = new Set(starred.map((e) => e.companyKey).filter(Boolean));
  return candidates
    .filter((c) => !(c.companyKey && keys.has(c.companyKey)))
    .map((c) => {
      const industry = industries.has(norm(c.industry));
      const country = countries.has(norm(c.country));
      const why = [industry && c.industry!.trim(), country && countryName(c.country!)].filter(Boolean).join(" · ");
      return { exhibitor: c, why, score: (industry ? 2 : 0) + (country ? 1 : 0) };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.exhibitor.name.localeCompare(b.exhibitor.name))
    .map(({ exhibitor, why }) => ({ exhibitor, why }));
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const short = (s: string) => (s.length > 200 ? `${s.slice(0, 197)}…` : s);

/**
 * The email for one person: subject, HTML and plain text. Follow-ups due
 * today or overdue come first; then what was added and what changed; then
 * new exhibitors at favorite trade shows that look like the favorites.
 */
export function digestEmail({
  accountName,
  entries,
  followUps = [],
  suggestions = [],
  listsUrl,
  favoritesUrl,
}: {
  accountName: string;
  entries: DigestEntry[];
  followUps?: DigestFollowUp[];
  suggestions?: DigestSuggestion[];
  listsUrl: string;
  favoritesUrl: string;
}) {
  const added = entries.filter((e) => e.addedBy).length;
  const changed = entries.filter((e) => e.changes.length > 0).length;
  const parts = [
    followUps.length > 0 && `${followUps.length} ${followUps.length === 1 ? "follow-up" : "follow-ups"} due`,
    added > 0 && `${added} new ${added === 1 ? "exhibitor" : "exhibitors"}`,
    changed > 0 && `${changed} updated`,
    suggestions.length > 0 && `${suggestions.length} new ${suggestions.length === 1 ? "exhibitor" : "exhibitors"} you may like`,
  ].filter(Boolean);
  const listed = suggestions.slice(0, MAX_SUGGESTIONS);
  const more = suggestions.length - listed.length;
  const moreText = more > 0 ? `…and ${more} more at your favorite trade shows.` : "";
  const subject = `${accountName}: ${parts.join(", ")} in your Favorites`;

  const lines = (e: DigestEntry) => [
    ...(e.addedBy ? [`Added to ${e.lists.join(", ")} by ${e.addedBy}`] : []),
    ...e.changes.map((c) => `${c.label}: ${c.value ? short(c.value) : "removed"}`),
  ];
  const footer = `You get this email because you are a user of ${accountName} in Trade Show System. Turn it off on the Saved lists page: ${listsUrl}`;

  const text = [
    ...(followUps.length > 0
      ? [
          "Follow-ups due:",
          "",
          ...followUps.flatMap((f) => [`${f.due}: ${f.exhibitor} (${f.tradeShow})`, ...(f.note ? [`  - ${short(f.note)}`] : []), ""]),
        ]
      : []),
    ...(entries.length > 0
      ? [
          `What is new in ${accountName}'s Favorites:`,
          "",
          ...entries.flatMap((e) => [`${e.exhibitor} (${e.tradeShow})${e.addedBy ? "" : ` · ${e.lists.join(", ")}`}`, ...lines(e).map((l) => `  - ${l}`), ""]),
        ]
      : []),
    ...(listed.length > 0
      ? [
          "New exhibitors you may like (at your favorite trade shows, like the ones you have starred):",
          "",
          ...listed.flatMap((x) => [`${x.exhibitor} (${x.tradeShow}) · ${x.why}`, `  Star it: ${x.url}`, ""]),
          ...(moreText ? [moreText, ""] : []),
        ]
      : []),
    `Open your Favorites: ${favoritesUrl}`,
    "",
    footer,
  ].join("\n");

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1b2a3a;max-width:600px">` +
    (followUps.length > 0
      ? `<h2 style="font-size:18px;margin:0 0 12px">Follow-ups due</h2>` +
        followUps
          .map(
            (f) =>
              `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 10px">` +
              `<div><span style="font-weight:bold">${escape(f.exhibitor)}</span> <span style="color:${f.due.startsWith("Overdue") ? "#c9372c" : "#a86500"};font-size:12px;font-weight:bold">${escape(f.due)}</span></div>` +
              `<div style="color:#64748b;font-size:12px">${escape(f.tradeShow)}</div>` +
              (f.note ? `<div style="margin-top:6px">${escape(short(f.note))}</div>` : "") +
              `</div>`,
          )
          .join("")
      : "") +
    (entries.length > 0 ? `<h2 style="font-size:18px;margin:${followUps.length > 0 ? "20px" : "0"} 0 12px">What is new in ${escape(accountName)}'s Favorites</h2>` : "") +
    entries
      .map(
        (e) =>
          `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 10px">` +
          `<div style="font-weight:bold">${escape(e.exhibitor)}</div>` +
          `<div style="color:#64748b;font-size:12px">${escape(e.tradeShow)}${e.addedBy ? "" : ` · ${escape(e.lists.join(", "))}`}</div>` +
          `<ul style="margin:8px 0 0;padding-left:18px">${lines(e).map((l) => `<li>${escape(l)}</li>`).join("")}</ul>` +
          `</div>`,
      )
      .join("") +
    (listed.length > 0
      ? `<h2 style="font-size:18px;margin:${followUps.length + entries.length > 0 ? "20px" : "0"} 0 4px">New exhibitors you may like</h2>` +
        `<p style="color:#64748b;font-size:12px;margin:0 0 12px">New at your favorite trade shows, and like the exhibitors you have starred.</p>` +
        listed
          .map(
            (x) =>
              `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 10px">` +
              `<div><span style="font-weight:bold">${escape(x.exhibitor)}</span> <a href="${escape(x.url)}" style="color:#287bbf;font-size:12px;font-weight:bold;text-decoration:none">&#9734; Star</a></div>` +
              `<div style="color:#64748b;font-size:12px">${escape(x.tradeShow)} · ${escape(x.why)}</div>` +
              `</div>`,
          )
          .join("") +
        (moreText ? `<p style="color:#64748b;margin:0 0 10px">${escape(moreText)}</p>` : "")
      : "") +
    `<p style="margin:16px 0"><a href="${escape(favoritesUrl)}" style="background:#287bbf;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold">Open your Favorites</a></p>` +
    `<p style="color:#64748b;font-size:12px">${escape(footer)}</p>` +
    `</div>`;

  return { subject, text, html };
}
