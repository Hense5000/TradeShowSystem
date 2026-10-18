import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { countryName } from "@/lib/countries";
import { formatDateRange } from "@/lib/dates";
import { DRAFT_LANGUAGES, type DraftLanguage, parseDraft } from "@/lib/email-draft";

// Writes a personal first email to a favorite exhibitor with Claude, from its
// company profile and the trade show. The draft is only shown to the user to
// edit and send from their own mail program; nothing is sent from here.

/** Which Claude model writes the drafts. Uses the same setting as the company profiles. */
const MODEL = process.env.COMPANY_PROFILE_MODEL || "claude-opus-5-5";
const AI_TIMEOUT_MS = 60_000;

export type DraftInput = {
  language: DraftLanguage;
  goal: string; // what the user wants from the email, e.g. "Book a meeting at the booth"; may be empty
  sender: { name: string; company: string; website: string | null };
  exhibitor: {
    name: string;
    contactName: string | null;
    contactTitle: string | null;
    industry: string | null;
    country: string | null;
    boothNumber: string | null;
    companyProfile: string | null;
  };
  tradeShow: { name: string; startDate: Date; endDate: Date; city: string | null };
};

const SYSTEM = `You write a short, personal first email from a salesperson to a company that exhibits at a trade show.

The email must:
- open with a greeting to the contact person by name if one is given, else a neutral greeting to the company;
- show in one or two sentences that the sender has looked at what the company does, using only the company profile given;
- mention the trade show by name and, if it is still to come, suggest meeting there (at the booth, if a booth number is given) or a short call;
- briefly say who the sender's company is, without inventing products, prices, customers or facts about it beyond what is given;
- be friendly, natural and specific, never pushy, with no buzzwords or exaggerations, at most about 140 words in the body;
- end with the sender's name and company on separate lines.

Answer in exactly this form and nothing else:
SUBJECT: <a short subject line>

<the email body as plain text, no markdown>`;

function line(label: string, value: string | null | undefined) {
  return value ? `${label}: ${value}\n` : "";
}

/** The draft's subject and body. Throws when the AI cannot be reached or declines. */
export async function writeEmailDraft(input: DraftInput, client = new Anthropic()): Promise<{ subject: string; body: string }> {
  const { exhibitor: e, tradeShow: t, sender: s } = input;
  const today = new Date();
  const status = t.endDate < today ? "already over" : t.startDate <= today ? "running now" : "still to come";
  const prompt =
    `Write the email in ${DRAFT_LANGUAGES[input.language]}.\n\n` +
    `<exhibitor>\n` +
    line("Company", e.name) +
    line("Contact person", e.contactName) +
    line("Contact's position", e.contactTitle) +
    line("Industry", e.industry) +
    line("Country", e.country && countryName(e.country)) +
    line("Company profile", e.companyProfile) +
    `</exhibitor>\n\n` +
    `<trade_show>\n` +
    line("Name", t.name) +
    line("Dates", `${formatDateRange(t.startDate, t.endDate)} (${status})`) +
    line("City", t.city) +
    line("The exhibitor's booth", e.boothNumber) +
    `</trade_show>\n\n` +
    `<sender>\n` +
    line("Name", s.name) +
    line("Company", s.company) +
    line("Company website", s.website) +
    `</sender>\n` +
    (input.goal ? `\nWhat the sender wants from this email: ${input.goal}\n` : "");

  const response = await client.messages.create(
    { model: MODEL, max_tokens: 4000, system: SYSTEM, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to write this email.");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const draft = parseDraft(text);
  if (!draft.body) throw new Error("The AI did not write an email. Try again.");
  return draft;
}
