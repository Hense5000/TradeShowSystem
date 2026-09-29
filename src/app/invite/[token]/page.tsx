import Link from "next/link";
import { auth } from "@/auth";
import { ActionForm } from "@/components/action-form";
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
      <div className="card mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Invitation not valid</h1>
        <p className="mt-2 text-zinc-600">{found ? MESSAGES[found.state] : "We couldn't find this invitation."}</p>
      </div>
    );
  }

  const { invitation } = found;
  const signedInEmail = session?.user?.email;
  return (
    <div className="card mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-xl font-semibold">Join {invitation.organization.name}</h1>
      <p className="text-zinc-600">
        You have been invited to join as <strong>{ROLE_LABEL[invitation.role]}</strong>.
      </p>
      {!signedInEmail ? (
        <div className="flex justify-center gap-2">
          <Link href={`/signup?invite=${token}`} className="btn">Create a user</Link>
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="btn-secondary">
            I already have one
          </Link>
        </div>
      ) : signedInEmail === invitation.email ? (
        <ActionForm action={accept.bind(null, token)}>
          <button className="btn">Accept invitation</button>
        </ActionForm>
      ) : (
        <p className="error">
          This invitation was sent to {invitation.email}, but you are logged in as {signedInEmail}. Log out and use
          the right email.
        </p>
      )}
    </div>
  );
}
