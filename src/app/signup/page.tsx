import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { findInvitation } from "@/lib/invitations";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { invite } = await searchParams;
  const found = typeof invite === "string" ? await findInvitation(invite) : null;
  const validInvite = found?.state === "pending" ? found.invitation : null;

  return (
    <AuthShell>
      <h1 className="page-title">{validInvite ? `Join ${validInvite.organization.name}` : "Create your account"}</h1>
      <p className="mt-1 mb-6 text-muted">
        {validInvite ? "Create your user to accept the invitation." : "One account per company. You can invite your colleagues afterwards."}
      </p>
      <SignupForm invite={validInvite ? (invite as string) : undefined} inviteEmail={validInvite?.email} />
      <p className="mt-6 text-center text-sm text-muted">
        Already have a user?{" "}
        <Link
          href={validInvite ? `/login?callbackUrl=${encodeURIComponent(`/invite/${invite}`)}` : "/login"}
          className="font-semibold text-brand hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
