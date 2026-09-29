"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeCallbackUrl } from "@/lib/redirect";
import { firstError, loginSchema } from "@/lib/validation";

// `email` is sent back so the form can keep it after an error (React clears forms on submit).
export type FormState = { error?: string; email?: string } | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error), email };
  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Wrong email or password.", email };
    throw error; // a successful sign-in "throws" a redirect
  }
}
