import "server-only";
import type { Prisma } from "@prisma/client";
import { slugify, uniqueSlug } from "@/lib/slug";

/** Creates a customer account with `userId` as its first owner, with a free trial ending at `trialEndsAt` if given. */
export async function createOrganization(
  tx: Prisma.TransactionClient,
  userId: string,
  name: string,
  { trialEndsAt }: { trialEndsAt?: Date } = {},
) {
  const slug = await uniqueSlug(slugify(name), async (s) =>
    Boolean(await tx.organization.findUnique({ where: { slug: s }, select: { id: true } })),
  );
  return tx.organization.create({
    data: { name, slug, trialEndsAt, memberships: { create: { userId, role: "OWNER" } } },
  });
}
