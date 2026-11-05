import "server-only";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { signupNotifyEmail, signupNotifyEmailContent } from "@/lib/signup-notify";

/** Tells the platform owner about a new customer account. A failed email must not stop the sign-up, so errors are only logged. */
export async function notifyNewSignup(person: { name: string; email: string; companyName: string }) {
  if (!isEmailConfigured()) return;
  try {
    await sendEmail({ to: signupNotifyEmail(), ...signupNotifyEmailContent(person) });
  } catch (e) {
    console.error("New sign-up notification failed", e);
  }
}
