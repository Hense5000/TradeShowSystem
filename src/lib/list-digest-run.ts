import "server-only";
import type { Prisma } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { today } from "@/lib/dates";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { followUpLabel } from "@/lib/leads";
import {
  changedFields,
  type DigestEntry,
  type DigestFollowUp,
  type DigestSuggestion,
  digestEmail,
  exhibitorSnapshot,
  similarExhibitors,
  type Snapshot,
} from "@/lib/list-digest";

/**
 * Sends each user the day's news on their accounts' Favorites lists (the
 * star; other saved lists are left out): exhibitors someone else starred,
 * starred exhibitors whose details changed, and follow-ups due today or
 * overdue on the user's own and unassigned leads, and new exhibitors at the
 * account's favorite trade shows that share an industry or a country with
 * the starred ones. Afterwards every reported
 * exhibitor's details are remembered, so nothing is told twice; a due
 * follow-up is told every day until it is moved or cleared on the Favorites
 * page.
 */
export async function runListDigest() {
  if (!isEmailConfigured()) return { skipped: "No email service is set up (RESEND_API_KEY and EMAIL_FROM)." };

  const organizations = await db.organization.findMany({
    where: { savedLists: { some: { favorites: true, items: { some: {} } } } },
    select: { id: true, name: true, slug: true },
  });
  const day = today();
  const runAt = new Date();
  let sent = 0;
  const errors: string[] = [];

  for (const org of organizations) {
    const items = await db.savedListItem.findMany({
      where: { list: { organizationId: org.id, favorites: true } },
      include: {
        list: { select: { name: true } },
        addedBy: { select: { name: true, email: true } },
        exhibitor: { include: { tradeShow: { select: { name: true } } } },
      },
      orderBy: [{ exhibitor: { name: "asc" } }],
    });

    // What happened to each item since the last email.
    const news = items.flatMap((item) => {
      const now = exhibitorSnapshot(item.exhibitor);
      const added = item.snapshot === null;
      const changes = added ? [] : changedFields(item.snapshot as Partial<Snapshot>, now);
      if (!added && changes.length === 0) return [];
      return [{ item, now, added, changes }];
    });
    const due = items
      .filter((i) => i.followUpAt && i.followUpAt <= day)
      .sort((a, b) => a.followUpAt!.getTime() - b.followUpAt!.getTime());

    // Exhibitors added to a favorite trade show since the last email (or since
    // the show was starred) that look like the starred exhibitors.
    const favoriteShows = await db.favoriteShow.findMany({
      where: { organizationId: org.id },
      select: { tradeShowId: true, addedAt: true, suggestedUntil: true },
    });
    const candidates =
      favoriteShows.length > 0
        ? await db.exhibitor.findMany({
            where: {
              OR: favoriteShows.map((f) => ({ tradeShowId: f.tradeShowId, createdAt: { gt: f.suggestedUntil ?? f.addedAt, lte: runAt } })),
              savedIn: { none: { list: { organizationId: org.id, favorites: true } } },
            },
            select: { id: true, name: true, industry: true, country: true, companyKey: true, tradeShow: { select: { id: true, name: true } } },
          })
        : [];
    const base = `${appUrl()}/a/${org.slug}`;
    const suggestions: DigestSuggestion[] = similarExhibitors(
      items.map((i) => i.exhibitor),
      candidates,
    ).map(({ exhibitor: e, why }) => ({
      exhibitor: e.name,
      tradeShow: e.tradeShow.name,
      why,
      url: `${base}/exhibitors?show=${e.tradeShow.id}&q=${encodeURIComponent(e.name)}`,
    }));
    // Each new exhibitor is only suggested once, also when a send fails.
    if (favoriteShows.length > 0) await db.favoriteShow.updateMany({ where: { organizationId: org.id }, data: { suggestedUntil: runAt } });

    if (news.length === 0 && due.length === 0 && suggestions.length === 0) continue;

    const members = await db.membership.findMany({
      where: { organizationId: org.id, user: { listEmails: true } },
      select: { user: { select: { id: true, email: true } } },
    });
    for (const { user } of members) {
      // One entry per exhibitor; one per list it was added to by someone else.
      const entries = new Map<string, DigestEntry>();
      for (const n of news) {
        const e = n.item.exhibitor;
        if (n.added) {
          if (n.item.addedById === user.id) continue;
          const by = n.item.addedBy?.name ?? n.item.addedBy?.email ?? "a user";
          const key = `added:${e.id}:${by}`;
          const entry = entries.get(key) ?? { exhibitor: e.name, tradeShow: e.tradeShow.name, lists: [], addedBy: by, changes: [] };
          entry.lists.push(n.item.list.name);
          entries.set(key, entry);
        } else {
          const key = `changed:${e.id}`;
          const entry = entries.get(key) ?? { exhibitor: e.name, tradeShow: e.tradeShow.name, lists: [], changes: n.changes };
          entry.lists.push(n.item.list.name);
          entries.set(key, entry);
        }
      }
      // Each user is reminded about their own leads and the ones no one is responsible for.
      const followUps: DigestFollowUp[] = due
        .filter((i) => i.assigneeId === null || i.assigneeId === user.id)
        .map((i) => ({ exhibitor: i.exhibitor.name, tradeShow: i.exhibitor.tradeShow.name, due: followUpLabel(i.followUpAt!, day), note: i.followUpNote }));
      if (entries.size === 0 && followUps.length === 0 && suggestions.length === 0) continue;
      try {
        await sendEmail({
          to: user.email,
          ...digestEmail({ accountName: org.name, entries: [...entries.values()], followUps, suggestions, listsUrl: `${base}/lists`, favoritesUrl: `${base}/favorites` }),
        });
        sent++;
      } catch (e) {
        errors.push(`${user.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Remember what was reported, also when a send failed, so the others are not told twice.
    if (news.length > 0) {
      await db.$transaction(
        news.map((n) =>
          db.savedListItem.update({
            where: { listId_exhibitorId: { listId: n.item.listId, exhibitorId: n.item.exhibitorId } },
            data: { snapshot: n.now as Prisma.InputJsonObject },
          }),
        ),
      );
    }
  }
  return { sent, errors };
}
