import Link from "next/link";
import { findInvitation } from "@/lib/invitations";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { invite } = await searchParams;
  const found = typeof invite === "string" ? await findInvitation(invite) : null;
  const validInvite = found?.state === "pending" ? found.invitation : null;

  return (
    <div className="card mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">{validInvite ? `Join ${validInvite.organization.name}` : "Create an account"}</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">
        {validInvite ? "Create your user to accept the invitation." : "One account per company. You can invite your colleagues afterwards."}
      </p>
      <SignupForm invite={validInvite ? (invite as string) : undefined} inviteEmail={validInvite?.email} />
      <p className="mt-6 text-sm text-zinc-600">
        Already have a user?{" "}
        <Link href={validInvite ? `/login?callbackUrl=${encodeURIComponent(`/invite/${invite}`)}` : "/login"} className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
