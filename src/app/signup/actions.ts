"use server";

import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { acceptInvitation, findInvitation } from "@/lib/invitations";
import { issueTicket } from "@/lib/login-guard";
import { createOrganization } from "@/lib/organizations";
import { billingConfigured, syncSeats } from "@/lib/stripe";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { firstError, signupSchema } from "@/lib/validation";

// Entered values (except the password) are sent back so the form keeps them after an error.
type Values = { name?: string; email?: string; companyName?: string };
export type FormState = { error?: string; values?: Values } | undefined;

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values: Values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
  };
  const fail = (error: string): FormState => ({ error, values });

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { name, email, password, companyName, invite } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return fail("There is already a user with this email. Log in instead.");

  const passwordHash = await bcrypt.hash(password, 12);
  let destination: string;
  let userId: string;

  if (invite) {
    // Joining someone else's account through an invite link.
    const found = await findInvitation(invite);
    if (!found || found.state !== "pending") return fail("This invitation is no longer valid.");
    if (found.invitation.email !== email)
      return fail(`This invitation was sent to ${found.invitation.email}. Sign up with that email.`);
    userId = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      await acceptInvitation(tx, found.invitation, user.id);
      return user.id;
    });
    await syncSeats(found.invitation.organizationId);
    destination = `/a/${found.invitation.organization.slug}`;
  } else {
    // Creating a brand new customer account.
    if (!companyName) return fail("Enter a company name.");
    const { user, organization } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      return { user, organization: await createOrganization(tx, user.id, companyName) };
    });
    userId = user.id;
    // A new account pays before it can be used: straight on to enter a card.
    destination =
      billingConfigured() && !isPlatformAdmin(email) ? `/a/${organization.slug}/billing/checkout` : `/a/${organization.slug}`;
  }

  // The browser used to sign up is trusted, so no login code is needed here.
  const ticket = await issueTicket(userId, { trustDevice: true });
  await signIn("credentials", { ticket, redirectTo: destination });
}
