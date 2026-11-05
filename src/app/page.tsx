import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth-shell";

export default async function Home() {
  if ((await auth())?.user) redirect("/accounts");
  return (
    <AuthShell>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Welcome</h1>
          <p className="mt-1 text-muted">Create an account for your company and invite your team.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/signup" className="btn w-full">Create an account</Link>
          <Link href="/login" className="btn-secondary w-full py-2">Log in</Link>
        </div>
        <div className="flex flex-col items-center pt-2 text-center">
          <Image src="/2step.jpeg" alt="2-step verification: one-time code" width={160} height={160} className="size-40" priority />
          <p className="mt-1 text-sm font-semibold text-ink">Protected by 2-step verification</p>
          <p className="mt-1 max-w-[34ch] text-sm text-muted">
            A password alone is not enough. Every login from a new device must be confirmed with a one-time code sent by
            email.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
