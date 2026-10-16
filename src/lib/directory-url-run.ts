import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { countryName } from "@/lib/countries";
import { answerLine, checkSearchedUrl } from "@/lib/events-page";
import { seenUrls } from "@/lib/events-page-run";

// Finds a trade show's exhibitor directory (the "Exhibitor directory URL"
// that "Fetch exhibitors" reads) by letting Claude search the web and look at
// the show's website. Only an address the search or fetch really returned is
// kept, never a guessed one. The directory may be on another site than the
// show's own, since many shows use an exhibitor platform for it.

/** Which Claude model looks for the directory. Can be changed with DIRECTORY_URL_MODEL. */
const MODEL = process.env.DIRECTORY_URL_MODEL || "claude-opus-5-5";

const AI_TIMEOUT_MS = 90_000;

export type ShowForSearch = { name: string; startDate: Date; city: string | null; country: string | null; website: string | null };

const SYSTEM = `You find a trade show's exhibitor list: the page on the web that lists the companies exhibiting at the show (often called "Exhibitor list", "Exhibitor directory", "Exhibitors", "Ausstellerverzeichnis" or "Liste des exposants").

Search the web for the show and open its official website. Find the page listing this edition's exhibitors; it may be on the show's own website or on an exhibitor platform the show links to. Prefer the full list of all exhibitors, in English when there is one. Do not use a page for companies who want to book a stand, a press release, news sites, social media or an other show's list.
Only give an address you actually saw in your search results or on fetched pages; never guess or build one. If the show has no public exhibitor list, say NONE.

End your answer with exactly this line:
DIRECTORY: <the exhibitor list's address, or NONE>`;

/** The show's exhibitor directory address, or null when AI found none. */
export async function findDirectoryUrl(show: ShowForSearch, client = new Anthropic()): Promise<string | null> {
  const where = [show.city, show.country && countryName(show.country)].filter(Boolean).join(", ");
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
  ];
  const lines = [
    `Trade show: ${show.name}`,
    `Starts: ${show.startDate.toISOString().slice(0, 10)}`,
    where && `Location: ${where}`,
    show.website && `Show website: ${show.website}`,
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: lines.filter(Boolean).join("\n") }];
  const seen: string[] = [];
  for (let round = 0; round < 3; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to look up this trade show.");
    seen.push(...seenUrls(response.content));
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return checkSearchedUrl(answerLine(text, "DIRECTORY"), seen, null);
  }
  return null;
}
