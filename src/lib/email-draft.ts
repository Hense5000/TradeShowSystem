// The standard first email to a favorite exhibitor: a general introduction of
// the user's company, filled in from the account's Company profile. No AI is
// used, so writing it costs nothing.

export const MAX_EMAIL_OFFER = 600;
export const MAX_EMAIL_BENEFIT = 150;
export const EMAIL_BENEFITS = 3;

export type EmailTemplateInput = {
  sender: { name: string; company: string; website: string | null; offer: string | null; benefits: string[] };
  exhibitor: { name: string; contactName: string | null };
  tradeShow: { name: string };
};

/** The email's subject and body. Lines without data are left out. */
export function standardEmail({ sender: s, exhibitor: e, tradeShow: t }: EmailTemplateInput): { subject: string; body: string } {
  const website = s.website?.replace(/\/+$/, "") || null;
  const benefits = s.benefits.map((b) => b.trim()).filter(Boolean);
  const paragraphs = [
    e.contactName?.trim() ? `Dear ${e.contactName.trim()},` : `Dear ${e.name} team,`,
    `I came across ${e.name} as an exhibitor at ${t.name}, and I would like to briefly introduce ${s.company}.`,
    s.offer?.trim() || null,
    `We work with companies like yours and would be happy to tell you more about how we could support ${e.name}.`,
    benefits.length ? benefits.map((b) => `• ${b}`).join("\n") : null,
    "If it sounds relevant, I would be glad to send you more information or set up a short call at a time that suits you.",
    website ? `You can read more about us at ${website}.` : null,
    ["Best regards,", s.name, s.company, website].filter(Boolean).join("\n"),
  ];
  return { subject: `Introduction: ${s.company}`, body: paragraphs.filter(Boolean).join("\n\n") };
}

/** A mailto: link that opens the user's own mail program with the draft filled in. */
export function mailtoHref(to: string | null, subject: string, body: string): string {
  const qs = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join("&");
  return `mailto:${to ? encodeURIComponent(to).replace(/%40/g, "@") : ""}${qs ? `?${qs}` : ""}`;
}
