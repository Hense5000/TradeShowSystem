import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LOGIN_CODE_MINUTES, maskEmail } from "@/lib/login-codes";
import { pendingLogin } from "@/lib/login-guard";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({ searchParams }: PageProps<"/login/verify">) {
  const { callbackUrl } = await searchParams;
  const next = typeof callbackUrl === "string" ? callbackUrl : undefined;
  const pending = await pendingLogin();
  if (!pending) redirect(next ? `/login?callbackUrl=${encodeURIComponent(next)}` : "/login");

  return (
    <AuthShell>
      <h1 className="page-title">Check your email</h1>
      <p className="mt-1 mb-6 text-muted">
        You are logging in from a new device. We sent a 6-digit code to{" "}
        <span className="font-semibold text-ink">{maskEmail(pending.user.email)}</span>. It works for {LOGIN_CODE_MINUTES}{" "}
        minutes, and this device is remembered for 30 days.
      </p>
      <VerifyForm callbackUrl={next} />
      <p className="mt-6 text-center text-sm text-muted">
        No email? Check your spam folder, or{" "}
        <Link href={next ? `/login?callbackUrl=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand hover:underline">
          log in again
        </Link>{" "}
        to get a new code.
      </p>
    </AuthShell>
  );
}
