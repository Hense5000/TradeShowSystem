import "server-only";
import { db } from "@/lib/db";
import { findOrganizer } from "@/lib/organizers";

export type OrganizerFound = { name: string; website?: string | null; country?: string | null };

let queue: Promise<unknown> = Promise.resolve();

async function linkOrganizer(found: OrganizerFound): Promise<string | null> {
  const name = found.name.replace(/\s+/g, " ").trim().slice(0, 150);
  if (!name) return null;
  const organizers = await db.exhibitionOrganizer.findMany({ select: { id: true, name: true, website: true, country: true } });
  const known = findOrganizer(name, organizers);
  if (known) {
    // Fill what the list is missing, never change what is there.
    if ((!known.website && found.website) || (!known.country && found.country)) {
      await db.exhibitionOrganizer.update({
        where: { id: known.id },
        data: { website: known.website ?? found.website ?? null, country: known.country ?? found.country ?? null },
      });
    }
    return known.id;
  }
  const created = await db.exhibitionOrganizer.create({ data: { name, website: found.website ?? null, country: found.country ?? null } });
  return created.id;
}

/**
 * The id of the organizer in the list with this name (see findOrganizer), or
 * of a new one added to the list when there is none. Calls run one at a time,
 * so two shows by the same new organizer don't add it twice.
 */
export function organizerIdFor(found: OrganizerFound): Promise<string | null> {
  const run = queue.then(() => linkOrganizer(found));
  queue = run.catch(() => undefined);
  return run;
}
