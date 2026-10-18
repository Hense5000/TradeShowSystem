"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { checkLoginCode } from "@/lib/login-codes";
import { completeCodeLogin, pendingLogin } from "@/lib/login-guard";
import { safeCallbackUrl } from "@/lib/redirect";

export type VerifyState = { error?: string } | undefined;

const MESSAGE = {
  wrong: "That code is not right. Check the email and try again.",
  expired: "The code has expired. Log in again to get a new one.",
  used: "The code has already been used. Log in again to get a new one.",
  "too-many": "Too many wrong codes. Log in again to get a new one.",
};

export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const pending = await pendingLogin();
  if (!pending) return { error: "Your login has expired. Please log in again." };

  const result = checkLoginCode(pending, String(formData.get("code") ?? ""));
  if (result !== "ok") {
    if (result === "wrong") await db.loginCode.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
    return { error: MESSAGE[result] };
  }

  const ticket = await completeCodeLogin(pending.id, pending.userId);
  try {
    await signIn("credentials", { ticket, redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Could not log you in. Please log in again." };
    throw error; // a successful sign-in "throws" a redirect
  }
}
