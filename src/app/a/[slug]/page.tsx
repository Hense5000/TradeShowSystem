import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";

function Stat({ icon, label, value, href }: { icon: IconName; label: string; value: React.ReactNode; href?: string }) {
  const body = (
    <>
      <span className="mb-2 grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
        <Icon name={icon} />
      </span>
      <span className="eyebrow">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </>
  );
  const cls = "card flex flex-col gap-1 p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:border-brand`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function AccountOverview({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug);
  const [memberCount, pendingInvites] = await Promise.all([
    db.membership.count({ where: { organizationId: organization.id } }),
    db.invitation.count({
      where: { organizationId: organization.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader title={firstName ? `Welcome, ${firstName}` : "Welcome"} description={`Here is where ${organization.name} stands.`} />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Stat icon="shield" label="Your role" value={ROLE_LABEL[membership.role]} />
        <Stat icon="users" label="Users" value={memberCount} href={`/a/${slug}/members`} />
        <Stat icon="mail" label="Pending invitations" value={pendingInvites} href={`/a/${slug}/members`} />
      </div>
    </>
  );
}
