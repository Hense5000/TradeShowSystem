"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { acceptInvitation, findInvitation } from "@/lib/invitations";
import { requireUser } from "@/lib/tenant";

export async function accept(token: string): Promise<{ error?: string } | undefined> {
  const user = await requireUser(`/invite/${token}`);
  const found = await findInvitation(token);
  if (!found || found.state !== "pending") return { error: "This invitation is no longer valid." };
  if (found.invitation.email !== user.email)
    return { error: `This invitation was sent to ${found.invitation.email}, but you are logged in as ${user.email}.` };

  try {
    await db.$transaction((tx) => acceptInvitation(tx, found.invitation, user.id));
  } catch {
    return { error: "This invitation is no longer valid." };
  }
  redirect(`/a/${found.invitation.organization.slug}`);
}
