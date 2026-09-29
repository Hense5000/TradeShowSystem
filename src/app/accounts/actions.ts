"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createOrganization } from "@/lib/organizations";
import { requireUser } from "@/lib/tenant";
import { accountSchema, firstError } from "@/lib/validation";

export type FormState = { error?: string } | undefined;

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const organization = await db.$transaction((tx) => createOrganization(tx, user.id, parsed.data.companyName));
  redirect(`/a/${organization.slug}`);
}
