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
      </div>
    </AuthShell>
  );
}
