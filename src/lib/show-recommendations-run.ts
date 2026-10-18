import "server-only";
import { syncCompanyKeys } from "@/lib/company-run";
import { db } from "@/lib/db";
import { MAX_RECOMMENDATIONS, rankRecommendations, type ShowSignals } from "@/lib/show-recommendations";

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The upcoming trade shows recommended to an account, with the show details,
 * leaving out its favorite shows and the ones it said it is not interested in.
 */
export async function recommendedShows(organizationId: string, today: Date, limit = MAX_RECOMMENDATIONS) {
  // The same company at two shows is matched by its company key.
  await syncCompanyKeys();
  const starred = await db.exhibitor.findMany({
    where: { savedIn: { some: { list: { organizationId, favorites: true } } } },
    select: { name: true, companyKey: true, industry: true },
  });
  if (starred.length === 0) return [];

  const keys = [...new Set(starred.map((e) => e.companyKey).filter((k): k is string => Boolean(k)))];
  const names = [...new Set(starred.filter((e) => !e.companyKey).map((e) => e.name))];
  const industries = [...new Set(starred.map((e) => e.industry?.trim()).filter((i): i is string => Boolean(i)))];
  const candidateShow = {
    endDate: { gte: today },
    favoriteOf: { none: { organizationId } },
    hiddenFrom: { none: { organizationId } },
  };

  const [leadRows, industryRows] = await Promise.all([
    // The favorite companies' rows at other upcoming shows.
    db.exhibitor.findMany({
      where: {
        tradeShow: candidateShow,
        OR: [...(keys.length ? [{ companyKey: { in: keys } }] : []), ...(names.length ? [{ name: { in: names } }] : [])],
      },
      select: { tradeShowId: true, name: true, companyKey: true },
    }),
    // Exhibitors at upcoming shows in the favorites' industries, per show and industry.
    industries.length
      ? db.exhibitor.groupBy({
          by: ["tradeShowId", "industry"],
          where: { tradeShow: candidateShow, OR: industries.map((i) => ({ industry: { equals: i, mode: "insensitive" as const } })) },
          _count: true,
        })
      : [],
  ]);

  const signals = new Map<string, ShowSignals & { seen: Set<string> }>();
  const signal = (id: string) => {
    let s = signals.get(id);
    if (!s) signals.set(id, (s = { tradeShowId: id, leads: [], industries: [], seen: new Set() }));
    return s;
  };
  for (const r of leadRows) {
    const s = signal(r.tradeShowId);
    const company = r.companyKey ?? norm(r.name);
    if (s.seen.has(company)) continue;
    s.seen.add(company);
    s.leads.push(r.name);
  }
  // Industries are written differently ("Medical devices", "medical Devices"); count them as one, named like the favorites.
  const label = new Map(industries.map((i) => [norm(i), i]));
  for (const r of industryRows) {
    const s = signal(r.tradeShowId);
    const name = label.get(norm(r.industry ?? "")) ?? r.industry ?? "";
    const found = s.industries.find((i) => i.industry === name);
    if (found) found.count += r._count;
    else s.industries.push({ industry: name, count: r._count });
  }
  for (const s of signals.values()) {
    s.industries.sort((a, b) => b.count - a.count);
    s.leads.sort((a, b) => a.localeCompare(b));
  }

  const ranked = rankRecommendations([...signals.values()].map(({ seen: _seen, ...s }) => s), limit);
  const shows = await db.tradeShow.findMany({
    where: { id: { in: ranked.map((r) => r.tradeShowId) } },
    include: { center: { select: { name: true } } },
  });
  return ranked.flatMap((r) => {
    const show = shows.find((s) => s.id === r.tradeShowId);
    return show ? [{ ...r, show }] : [];
  });
}
