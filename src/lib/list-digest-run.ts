import "server-only";
import type { Prisma } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { changedFields, type DigestEntry, digestEmail, exhibitorSnapshot, type Snapshot } from "@/lib/list-digest";

/**
 * Sends each user the day's news on their accounts' Favorites lists (the
 * star; other saved lists are left out): exhibitors someone else starred,
 * and starred exhibitors whose details changed. Afterwards every
 * reported exhibitor's details are remembered, so nothing is told twice.
 */
export async function runListDigest() {
  if (!isEmailConfigured()) return { skipped: "No email service is set up (RESEND_API_KEY and EMAIL_FROM)." };

  const organizations = await db.organization.findMany({
    where: { savedLists: { some: { favorites: true, items: { some: {} } } } },
    select: { id: true, name: true, slug: true },
  });
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
    if (news.length === 0) continue;

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
      if (entries.size === 0) continue;
      try {
        await sendEmail({ to: user.email, ...digestEmail({ accountName: org.name, entries: [...entries.values()], listsUrl: `${appUrl()}/a/${org.slug}/lists` }) });
        sent++;
      } catch (e) {
        errors.push(`${user.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Remember what was reported, also when a send failed, so the others are not told twice.
    await db.$transaction(
      news.map((n) =>
        db.savedListItem.update({
          where: { listId_exhibitorId: { listId: n.item.listId, exhibitorId: n.item.exhibitorId } },
          data: { snapshot: n.now as Prisma.InputJsonObject },
        }),
      ),
    );
  }
  return { sent, errors };
}
