import { countryName } from "@/lib/countries";

// The daily email about what is new on an account's saved lists. This file
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

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const short = (s: string) => (s.length > 200 ? `${s.slice(0, 197)}…` : s);

/** The email for one person: subject, HTML and plain text. */
export function digestEmail({ accountName, entries, listsUrl }: { accountName: string; entries: DigestEntry[]; listsUrl: string }) {
  const added = entries.filter((e) => e.addedBy).length;
  const changed = entries.filter((e) => e.changes.length > 0).length;
  const parts = [
    added > 0 && `${added} new ${added === 1 ? "exhibitor" : "exhibitors"}`,
    changed > 0 && `${changed} updated`,
  ].filter(Boolean);
  const subject = `${accountName}: ${parts.join(", ")} on your saved lists`;

  const lines = (e: DigestEntry) => [
    ...(e.addedBy ? [`Added to ${e.lists.join(", ")} by ${e.addedBy}`] : []),
    ...e.changes.map((c) => `${c.label}: ${c.value ? short(c.value) : "removed"}`),
  ];
  const footer = `You get this email because you are a user of ${accountName} in Trade Show System. Turn it off on the Saved lists page: ${listsUrl}`;

  const text = [
    `What is new on ${accountName}'s saved lists:`,
    "",
    ...entries.flatMap((e) => [`${e.exhibitor} (${e.tradeShow})${e.addedBy ? "" : ` · ${e.lists.join(", ")}`}`, ...lines(e).map((l) => `  - ${l}`), ""]),
    `Open your lists: ${listsUrl}`,
    "",
    footer,
  ].join("\n");

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1b2a3a;max-width:600px">` +
    `<h2 style="font-size:18px;margin:0 0 12px">What is new on ${escape(accountName)}'s saved lists</h2>` +
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
    `<p style="margin:16px 0"><a href="${escape(listsUrl)}" style="background:#287bbf;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold">Open your lists</a></p>` +
    `<p style="color:#64748b;font-size:12px">${escape(footer)}</p>` +
    `</div>`;

  return { subject, text, html };
}
