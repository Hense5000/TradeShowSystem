import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { describeProfileError, isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { countryName } from "@/lib/countries";
import { isoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { checkSearchedUrl } from "@/lib/events-page";
import { seenUrls } from "@/lib/events-page-run";
import { organizerIdFor } from "@/lib/organizer-link";
import { type OrganizerFillResult, parseOrganizerAnswer } from "@/lib/organizer-finder";

// Finds who organizes a trade show. AI searches the web (usually the show's
// own website names the organizer) and the organizer is linked to the show:
// one already in the organizers list when the names match, otherwise a new
// one is added to the list. Only websites the search really returned are kept.

/** Which Claude model looks up organizers. Can be changed with ORGANIZER_FINDER_MODEL. */
const MODEL = process.env.ORGANIZER_FINDER_MODEL || "claude-opus-5-5";

const AI_TIMEOUT_MS = 90_000;
const PARALLEL = 5;
/** At most this many known organizer names are shown to the AI. */
const MAX_KNOWN = 2000;

/** The same AI key as the company profiles. */
export const isOrganizerFinderConfigured = isCompanyProfileConfigured;
export const describeOrganizerError = describeProfileError;

export type Show = { name: string; startDate: Date; city: string | null; country: string | null; website: string | null };

const SYSTEM = `You find the company that organizes a trade show, for a trade show directory.

Search the web for the show; its official website usually names the organizer in the footer, imprint, "About" or contact page. The organizer is the company that runs the show (for example Messe Frankfurt, RX, Informa Markets, Messe München), not the venue, a sponsor or a partner association, unless the venue itself runs the show.
If the organizer is one of the companies in the list you are given, write its name exactly as listed. Otherwise give the company's name as it writes it, without the address.
Only give a website you actually saw in your search results or on fetched pages; never guess or build one.

End your answer with exactly these three lines:
ORGANIZER: <the organizer's name, or NONE if you could not find it>
WEBSITE: <the organizer's own website, or NONE>
COUNTRY: <the country of the organizer's head office, in English, or NONE>`;

/** Lets Claude search the web for the show's organizer. Null when it found none. */
export async function lookUpOrganizer(show: Show, known: string[], client = new Anthropic()) {
  const where = [show.city, show.country && countryName(show.country)].filter(Boolean).join(", ");
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
  ];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        `Trade show: ${show.name}`,
        `Starts: ${isoDate(show.startDate)}`,
        where && `Location: ${where}`,
        show.website && `Website: ${show.website}`,
        known.length > 0 && `\nOrganizers already in the list:\n${known.join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const seen: string[] = [];
  for (let round = 0; round < 3; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to look up this show.");
    seen.push(...seenUrls(response.content));
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const answer = parseOrganizerAnswer(text);
    if (!answer.name) return null;
    return { name: answer.name, website: checkSearchedUrl(answer.website, seen, null), country: answer.country };
  }
  return null;
}

/** Shows with no organizer that AI has not tried yet. */
export const missingOrganizerWhere: Prisma.TradeShowWhereInput = { organizerId: null, organizerTriedAt: null };

/**
 * Looks up the missing organizers, a few shows at a time, until they are all
 * done or the time budget is used up. Newest shows go first. Only shows still
 * without an organizer are changed, and each show is tried once, so one AI
 * can't find is not searched again and again.
 */
export async function fillMissingOrganizers({ budgetMs, limit = 500 }: { budgetMs: number; limit?: number }): Promise<OrganizerFillResult> {
  const started = Date.now();
  const totals: OrganizerFillResult = { filled: 0, notFound: 0, failed: 0, left: 0 };
  if (!isOrganizerFinderConfigured()) {
    totals.left = await db.tradeShow.count({ where: missingOrganizerWhere });
    return totals;
  }

  const [queue, organizers] = await Promise.all([
    db.tradeShow.findMany({
      where: missingOrganizerWhere,
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      select: { id: true, name: true, startDate: true, city: true, country: true, website: true },
      take: limit,
    }),
    db.exhibitionOrganizer.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: MAX_KNOWN }),
  ]);
  const known = organizers.map((o) => o.name);
  const client = new Anthropic();
  let next = 0;
  let stopped = false;
  async function worker() {
    while (!stopped && next < queue.length && Date.now() - started < budgetMs) {
      const show = queue[next++];
      try {
        const found = await lookUpOrganizer(show, known, client);
        const organizerId = found ? await organizerIdFor(found) : null;
        const saved = organizerId
          ? await db.tradeShow.updateMany({ where: { id: show.id, organizerId: null }, data: { organizerId, organizerTriedAt: new Date() } })
          : { count: 0 };
        if (saved.count > 0) totals.filled++;
        else {
          totals.notFound++;
          await db.tradeShow.updateMany({ where: { id: show.id }, data: { organizerTriedAt: new Date() } });
        }
      } catch (error) {
        // A busy or broken AI service fails every show; stop and leave them for the next run.
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError) {
          stopped = true;
          totals.stoppedBy = describeOrganizerError(error);
          return;
        }
        totals.failed++;
        await db.tradeShow.updateMany({ where: { id: show.id }, data: { organizerTriedAt: new Date() } });
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  totals.left = await db.tradeShow.count({ where: missingOrganizerWhere });
  return totals;
}
