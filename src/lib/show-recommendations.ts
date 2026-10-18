// Trade shows recommended to an account from its favorites: upcoming shows
// where its favorite companies also exhibit, or with many exhibitors in the
// same industries. The ranking is plain counting, so it is instant and every
// reason can be checked on the show's exhibitor list.

/** The most recommendations shown in one place. */
export const MAX_RECOMMENDATIONS = 5;

export type ShowSignals = {
  tradeShowId: string;
  leads: string[]; // names of the account's favorite companies exhibiting at the show
  industries: { industry: string; count: number }[]; // exhibitors in the favorites' industries, most first
};

export type Recommendation = ShowSignals & { score: number; reason: string };

const list = (names: string[]) =>
  names.length <= 3 ? names.join(", ").replace(/, ([^,]*)$/, " and $1") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

/** Why a show is recommended, e.g. "3 of your leads exhibit here: Dräger, Ambu and Coloplast · 12 exhibitors in Medical devices". */
export function recommendationReason(s: ShowSignals): string {
  const parts: string[] = [];
  if (s.leads.length > 0) {
    parts.push(`${s.leads.length === 1 ? "1 of your leads exhibits" : `${s.leads.length} of your leads exhibit`} here: ${list(s.leads)}`);
  }
  const top = s.industries[0];
  if (top) parts.push(`${top.count} ${top.count === 1 ? "exhibitor" : "exhibitors"} in ${top.industry}`);
  return parts.join(" · ");
}

/**
 * The shows worth recommending, best first. A favorite company exhibiting
 * counts far more than an exhibitor in the same industry; a show needs at
 * least one favorite company or two exhibitors in the favorites' industries.
 */
export function rankRecommendations(signals: ShowSignals[], limit = MAX_RECOMMENDATIONS): Recommendation[] {
  return signals
    .map((s) => {
      const similar = s.industries.reduce((sum, i) => sum + i.count, 0);
      return { ...s, similar, score: s.leads.length * 10 + Math.min(similar, 20), reason: recommendationReason(s) };
    })
    .filter((s) => s.leads.length > 0 || s.similar >= 2)
    .sort((a, b) => b.score - a.score || b.similar - a.similar)
    .slice(0, limit)
    .map(({ similar: _similar, ...r }) => r);
}
