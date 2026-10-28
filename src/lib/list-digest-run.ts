import "server-only";
import type { Prisma } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { syncCompanyKeys } from "@/lib/company-run";
import { isoDate, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { followUpReminderEmail } from "@/lib/follow-up-reminder";
import { followUpLabel } from "@/lib/leads";
import {
  changedFields,
  changedShowFields,
  type DigestEntry,
  type DigestFollowUp,
  type DigestShow,
  type DigestSuggestion,
  digestEmail,
  exhibitorSnapshot,
  showSnapshot,
  type ShowSnapshot,
  similarExhibitors,
  type Snapshot,
} from "@/lib/list-digest";

/**
 * Sends each user the day's news on their accounts' Favorites lists (the
 * star; other saved lists are left out): exhibitors someone else starred,
 * starred exhibitors whose details changed, and follow-ups due today or
 * overdue on the user's own and unassigned leads, and new exhibitors at the
 * account's favorite trade shows that share an industry or a country with
 * the starred ones, and favorite trade shows whose details changed or that
 * got new exhibitors. Each user chooses which of these parts they get.
 * Afterwards every reported exhibitor's and show's details are remembered, so nothing is told twice; a due
 * follow-up is told every day until it is moved or cleared on the Favorites
 * page.
 *
 * Besides the digest, the user responsible for a lead gets an email of its
 * own on the day its follow-up is due, whatever their digest settings. That
 * follow-up is then left out of their digest that day so it is not told twice.
 */
export async function runListDigest() {
  if (!isEmailConfigured()) return { skipped: "No email service is set up (RESEND_API_KEY and EMAIL_FROM)." };
  // Favorites follow their company to its latest trade show first.
  await syncCompanyKeys();

  const organizations = await db.organization.findMany({
    where: { OR: [{ savedLists: { some: { favorites: true, items: { some: {} } } } }, { favoriteShows: { some: {} } }] },
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
      select: {
        tradeShowId: true,
        addedAt: true,
        suggestedUntil: true,
        snapshot: true,
        tradeShow: { select: { name: true, startDate: true, endDate: true, city: true, country: true, website: true, exhibitorDirectoryUrl: true, center: { select: { name: true } } } },
      },
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

    // Favorite trade shows whose details changed, or that got new exhibitors,
    // since the last email. A show seen for the first time is only remembered.
    const newCounts =
      favoriteShows.length > 0
        ? await db.exhibitor.groupBy({
            by: ["tradeShowId"],
            where: { OR: favoriteShows.map((f) => ({ tradeShowId: f.tradeShowId, createdAt: { gt: f.suggestedUntil ?? f.addedAt, lte: runAt } })) },
            _count: { _all: true },
          })
        : [];
    const newByShow = new Map(newCounts.map((c) => [c.tradeShowId, c._count._all]));
    const showNews = favoriteShows.map((f) => {
      const now = showSnapshot(f.tradeShow);
      const changes = f.snapshot === null ? [] : changedShowFields(f.snapshot as Partial<ShowSnapshot>, now);
      return { f, now, changes, newExhibitors: newByShow.get(f.tradeShowId) ?? 0 };
    });
    const shows: DigestShow[] = showNews
      .filter((n) => n.changes.length > 0 || n.newExhibitors > 0)
      .sort((a, b) => a.f.tradeShow.startDate.getTime() - b.f.tradeShow.startDate.getTime())
      .map((n) => ({ tradeShow: n.f.tradeShow.name, changes: n.changes, newExhibitors: n.newExhibitors, url: `${base}/exhibitors?show=${n.f.tradeShowId}` }));

    // Each new exhibitor is only suggested once and each show change only told
    // once, also when a send fails.
    if (favoriteShows.length > 0) {
      await db.$transaction(
        showNews.map((n) =>
          db.favoriteShow.update({
            where: { organizationId_tradeShowId: { organizationId: org.id, tradeShowId: n.f.tradeShowId } },
            data: { suggestedUntil: runAt, snapshot: n.now as Prisma.InputJsonObject },
          }),
        ),
      );
    }

    // Today's follow-ups go straight to the user responsible, if they are still in the account.
    const remindedToday = new Set<string>(); // "userId:exhibitorId"
    const dueToday = due.filter((i) => i.assigneeId && isoDate(i.followUpAt!) === isoDate(day));
    if (dueToday.length > 0) {
      const assignees = await db.membership.findMany({
        where: { organizationId: org.id, userId: { in: [...new Set(dueToday.map((i) => i.assigneeId!))] } },
        select: { user: { select: { id: true, email: true } } },
      });
      for (const { user } of assignees) {
        const mine = dueToday.filter((i) => i.assigneeId === user.id);
        try {
          await sendEmail({
            to: user.email,
            ...followUpReminderEmail({
              accountName: org.name,
              leads: mine.map((i) => ({ exhibitor: i.exhibitor.name, tradeShow: i.exhibitor.tradeShow.name, note: i.followUpNote })),
              url: `${base}/favorites/exhibitors?owner=me&followup=due`,
            }),
          });
          sent++;
          for (const i of mine) remindedToday.add(`${user.id}:${i.exhibitorId}`);
        } catch (e) {
          errors.push(`${user.email} (reminder): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    if (news.length === 0 && due.length === 0 && suggestions.length === 0 && shows.length === 0) continue;

    const members = await db.membership.findMany({
      where: { organizationId: org.id, user: { listEmails: true } },
      select: { user: { select: { id: true, email: true, emailExhibitorChanges: true, emailShowChanges: true, emailFollowUps: true, emailSuggestions: true } } },
    });
    for (const { user } of members) {
      // One entry per exhibitor; one per list it was added to by someone else.
      const entries = new Map<string, DigestEntry>();
      for (const n of user.emailExhibitorChanges ? news : []) {
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
      const followUps: DigestFollowUp[] = (user.emailFollowUps ? due : [])
        .filter((i) => i.assigneeId === null || i.assigneeId === user.id)
        .filter((i) => !remindedToday.has(`${user.id}:${i.exhibitorId}`))
        .map((i) => ({ exhibitor: i.exhibitor.name, tradeShow: i.exhibitor.tradeShow.name, due: followUpLabel(i.followUpAt!, day), note: i.followUpNote }));
      const mySuggestions = user.emailSuggestions ? suggestions : [];
      const myShows = user.emailShowChanges ? shows : [];
      if (entries.size === 0 && followUps.length === 0 && mySuggestions.length === 0 && myShows.length === 0) continue;
      try {
        await sendEmail({
          to: user.email,
          ...digestEmail({ accountName: org.name, entries: [...entries.values()], followUps, suggestions: mySuggestions, shows: myShows, listsUrl: `${base}/lists`, favoritesUrl: `${base}/favorites/exhibitors` }),
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
