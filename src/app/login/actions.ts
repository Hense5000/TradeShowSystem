"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { deviceCheckEnabled, isTrustedDevice, issueTicket, sendLoginCode } from "@/lib/login-guard";
import { safeCallbackUrl } from "@/lib/redirect";
import { firstError, loginSchema } from "@/lib/validation";

// `email` is sent back so the form can keep it after an error (React clears forms on submit).
export type FormState = { error?: string; email?: string } | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error), email };
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user?.passwordHash ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) return { error: "Wrong email or password.", email };

  // A browser this user hasn't logged in from: confirm with a code by email.
  if (deviceCheckEnabled() && !(await isTrustedDevice(user.id))) {
    try {
      await sendLoginCode(user);
    } catch (error) {
      console.error("Could not send the login code", error);
      return { error: "We could not send your login code. Please try again in a moment.", email };
    }
    redirect(`/login/verify?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  try {
    await signIn("credentials", { ticket: await issueTicket(user.id), redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Could not log you in. Please try again.", email };
    throw error; // a successful sign-in "throws" a redirect
  }
}
