import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Icon } from "@/components/icons";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const next = typeof callbackUrl === "string" ? callbackUrl : undefined;
  // Coming from an invite link: sign up through the invitation instead.
  const inviteToken = next?.match(/^\/invite\/([\w-]+)$/)?.[1];
  const signupHref = inviteToken ? `/signup?invite=${inviteToken}` : "/signup";
  return (
    <AuthShell>
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
        <Icon name="shield" className="size-3.5" />
        Protected by 2-step verification
      </p>
      <h1 className="page-title">Log in</h1>
      <p className="mt-1 mb-6 text-muted">Welcome back.</p>
      <LoginForm callbackUrl={next} />
      <div className="mt-5 flex gap-3 rounded-lg border border-line bg-subtle p-3 text-sm text-muted">
        <Icon name="shield" className="mt-0.5 size-[18px] shrink-0 text-brand" />
        <p>
          <span className="font-semibold text-ink">2-step verification is required.</span> A password alone is not enough:
          every login from a new device must be confirmed with a one-time code sent to the account&apos;s email.
        </p>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href={signupHref} className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
