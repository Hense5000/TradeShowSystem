import Link from "next/link";
import { auth } from "@/auth";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { findInvitation } from "@/lib/invitations";
import { ROLE_LABEL } from "@/lib/permissions";
import type { InvitationState } from "@/lib/tokens";
import { accept } from "./actions";

const MESSAGES: Record<InvitationState, string> = {
  pending: "",
  accepted: "This invitation has already been used.",
  revoked: "This invitation has been withdrawn.",
  expired: "This invitation has expired. Ask for a new one.",
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const found = await findInvitation(token);
  const session = await auth();

  if (!found || found.state !== "pending") {
    return (
      <AuthShell>
        <h1 className="page-title">Invitation not valid</h1>
        <p className="mt-2 text-muted">{found ? MESSAGES[found.state] : "We couldn't find this invitation."}</p>
      </AuthShell>
    );
  }

  const { invitation } = found;
  const signedInEmail = session?.user?.email;
  return (
    <AuthShell>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Join {invitation.organization.name}</h1>
          <p className="mt-1 text-muted">
            You have been invited to join as <strong className="text-ink">{ROLE_LABEL[invitation.role]}</strong>.
          </p>
        </div>
        {!signedInEmail ? (
          <div className="flex flex-col gap-2">
            <Link href={`/signup?invite=${token}`} className="btn w-full">Create a user</Link>
            <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="btn-secondary w-full py-2">
              I already have one
            </Link>
          </div>
        ) : signedInEmail === invitation.email ? (
          <ActionForm action={accept.bind(null, token)}>
            <button className="btn w-full">Accept invitation</button>
          </ActionForm>
        ) : (
          <p className="error">
            This invitation was sent to {invitation.email}, but you are logged in as {signedInEmail}. Log out and use
            the right email.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
