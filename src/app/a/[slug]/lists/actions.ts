"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import { db } from "@/lib/db";
import { type ExhibitorFilters, exhibitorWhere } from "@/lib/exhibitor-list";
import { checkListName, FAVORITES_NAME, MAX_ADD_AT_ONCE } from "@/lib/saved-lists";
import { requireMembership } from "@/lib/tenant";

// Every member of an account may change its lists. Each action checks that
// the list belongs to the account in the URL, so no account can touch another's.

function refresh(slug: string) {
  revalidatePath(`/a/${slug}/exhibitors`);
  revalidatePath(`/a/${slug}/lists`, "layout");
}

async function takenNames(organizationId: string, exceptId?: string) {
  const lists = await db.savedList.findMany({
    where: { organizationId, favorites: false, id: exceptId ? { not: exceptId } : undefined },
    select: { name: true },
  });
  return lists.map((l) => l.name);
}

/** The id of this account's list, or undefined when it isn't one. */
async function ownListId(organizationId: string, listId: string) {
  const list = await db.savedList.findFirst({ where: { id: listId, organizationId }, select: { id: true } });
  return list?.id;
}

/** The account's Favorites list, created the first time it is needed. */
async function favoritesListId(organizationId: string) {
  const existing = await db.savedList.findFirst({ where: { organizationId, favorites: true }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const created = await db.savedList.create({ data: { organizationId, name: FAVORITES_NAME, favorites: true } });
    return created.id;
  } catch (e) {
    // Another member clicked a star at the same moment and created it first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await db.savedList.findFirstOrThrow({ where: { organizationId, favorites: true }, select: { id: true } });
      return again.id;
    }
    throw e;
  }
}

async function setInList(listId: string, exhibitorId: string, add: boolean, addedById: string) {
  if (add) {
    await db.savedListItem.createMany({ data: [{ listId, exhibitorId, addedById }], skipDuplicates: true });
  } else {
    await db.savedListItem.deleteMany({ where: { listId, exhibitorId } });
  }
  await db.savedList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
}

export async function createList(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireMembership(slug);
  const checked = checkListName(formData.get("name"), await takenNames(organization.id));
  if (checked.error !== undefined) return { error: checked.error };

  const list = await db.savedList.create({ data: { organizationId: organization.id, name: checked.name } });
  refresh(slug);
  redirect(`/a/${slug}/lists/${list.id}`);
}

export async function renameList(slug: string, listId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug);
  const checked = checkListName(formData.get("name"), await takenNames(organization.id, listId));
  if (checked.error !== undefined) return { error: checked.error };

  const { count } = await db.savedList.updateMany({
    where: { id: listId, organizationId: organization.id, favorites: false },
    data: { name: checked.name },
  });
  if (count === 0) return { error: "This list no longer exists." };
  refresh(slug);
  return { saved: true };
}

export async function deleteList(slug: string, listId: string): Promise<ActionState> {
  const { organization } = await requireMembership(slug);
  await db.savedList.deleteMany({ where: { id: listId, organizationId: organization.id, favorites: false } });
  refresh(slug);
  redirect(`/a/${slug}/lists`);
}

/** The star on the Exhibitors page: adds the exhibitor to Favorites, or takes it off. */
export async function toggleFavorite(slug: string, exhibitorId: string, add: boolean) {
  const { user, organization } = await requireMembership(slug);
  await setInList(await favoritesListId(organization.id), exhibitorId, add, user.id);
  refresh(slug);
}

/**
 * The list menu on the Exhibitors page. The pressed button sends "add:<list id>"
 * or "remove:<list id>", so one action serves every list in the menu.
 */
export async function setListMembership(slug: string, exhibitorId: string, formData: FormData) {
  const { user, organization } = await requireMembership(slug);
  const [change, listId] = String(formData.get("change") ?? "").split(":");
  const id = listId && (await ownListId(organization.id, listId));
  if (!id || (change !== "add" && change !== "remove")) return;
  await setInList(id, exhibitorId, change === "add", user.id);
  refresh(slug);
}

/** Adds every exhibitor the Exhibitors page shows with these filters to the chosen list. */
export async function addShownToList(slug: string, filters: ExhibitorFilters, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, organization } = await requireMembership(slug);
  const chosen = String(formData.get("list") ?? "");
  const listId = chosen === "favorites" ? await favoritesListId(organization.id) : await ownListId(organization.id, chosen);
  if (!listId) return { error: "Choose a list." };

  const exhibitors = await db.exhibitor.findMany({
    where: exhibitorWhere(filters),
    select: { id: true },
    orderBy: [{ name: "asc" }],
    take: MAX_ADD_AT_ONCE,
  });
  await db.savedListItem.createMany({ data: exhibitors.map((e) => ({ listId, exhibitorId: e.id, addedById: user.id })), skipDuplicates: true });
  await db.savedList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
  refresh(slug);
  redirect(`/a/${slug}/lists/${listId}`);
}

/** The signed-in user's own choice: the daily email about what is new on the lists, on or off. */
export async function setListEmails(slug: string, on: boolean) {
  const { user } = await requireMembership(slug);
  await db.user.update({ where: { id: user.id }, data: { listEmails: on } });
  revalidatePath(`/a/${slug}/lists`);
}
