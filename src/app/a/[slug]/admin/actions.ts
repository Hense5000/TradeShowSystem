"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import { db } from "@/lib/db";
import { featureSchema } from "@/lib/features";
import { slugify, uniqueSlug } from "@/lib/slug";
import { requirePlatformAdmin } from "@/lib/tenant";
import { firstError } from "@/lib/validation";

function parse(formData: FormData) {
  const parsed = featureSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    rollout: formData.get("rollout") ?? "",
  });
  const accountIds = formData.getAll("accounts").filter((v): v is string => typeof v === "string");
  return { parsed, accountIds };
}

/** Replaces the accounts that get the feature while it is on for selected accounts. */
async function setAccess(featureId: string, accountIds: string[]) {
  const existing = await db.organization.findMany({ where: { id: { in: accountIds } }, select: { id: true } });
  await db.$transaction([
    db.featureAccess.deleteMany({ where: { featureId } }),
    db.featureAccess.createMany({ data: existing.map((o) => ({ featureId, organizationId: o.id })) }),
  ]);
}

function refresh(slug: string) {
  // The menu and the customers' Features page depend on this, in every account.
  revalidatePath("/a/[slug]", "layout");
  revalidatePath(`/a/${slug}/admin`);
}

export async function createFeature(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const { parsed, accountIds } = parse(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const duplicate = await db.feature.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) return { error: `${parsed.data.name} is already in the list.` };

  const key = await uniqueSlug(slugify(parsed.data.name), async (k) => (await db.feature.count({ where: { key: k } })) > 0);
  const feature = await db.feature.create({ data: { ...parsed.data, key } });
  await setAccess(feature.id, accountIds);
  refresh(slug);
  redirect(`/a/${slug}/admin`);
}

export async function updateFeature(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const { parsed, accountIds } = parse(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const duplicate = await db.feature.findFirst({
    where: { id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (duplicate) return { error: `Another feature is already called ${parsed.data.name}.` };

  const { count } = await db.feature.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) return { error: "This feature no longer exists." };
  await setAccess(id, accountIds);
  refresh(slug);
  return { saved: true };
}

export async function deleteFeature(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.feature.deleteMany({ where: { id } });
  refresh(slug);
  redirect(`/a/${slug}/admin`);
}
