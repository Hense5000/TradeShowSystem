import Link from "next/link";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";

export default async function AccountOverview({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const { membership, organization } = await requireMembership(slug);
  const [memberCount, pendingInvites] = await Promise.all([
    db.membership.count({ where: { organizationId: organization.id } }),
    db.invitation.count({
      where: { organizationId: organization.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card">
        <p className="text-sm text-zinc-500">Your role</p>
        <p className="mt-1 text-xl font-semibold">{ROLE_LABEL[membership.role]}</p>
      </div>
      <Link href={`/a/${slug}/members`} className="card hover:border-zinc-400">
        <p className="text-sm text-zinc-500">Users</p>
        <p className="mt-1 text-xl font-semibold">{memberCount}</p>
      </Link>
      <Link href={`/a/${slug}/members`} className="card hover:border-zinc-400">
        <p className="text-sm text-zinc-500">Pending invitations</p>
        <p className="mt-1 text-xl font-semibold">{pendingInvites}</p>
      </Link>
    </div>
  );
}
