import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { canManageMembers, ROLE_LABEL } from "@/lib/permissions";
import { isProfileComplete } from "@/lib/profile";
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
  const [memberCount, pendingInvites, primaryContact] = await Promise.all([
    db.membership.count({ where: { organizationId: organization.id } }),
    db.invitation.count({
      where: { organizationId: organization.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    db.contact.findFirst({ where: { organizationId: organization.id, isPrimary: true } }),
  ]);
  const steps = [
    { label: "Create the account", done: true },
    { label: "Invite your team", done: memberCount > 1 || pendingInvites > 0, href: `/a/${slug}/members` },
    { label: "Add company details and a primary contact", done: isProfileComplete(organization, primaryContact), href: `/a/${slug}/profile` },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader title={firstName ? `Welcome, ${firstName}` : "Welcome"} description={`Here is where ${organization.name} stands.`} />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Stat icon="shield" label="Your role" value={ROLE_LABEL[membership.role]} />
        <Stat icon="users" label="Users" value={memberCount} href={`/a/${slug}/members`} />
        <Stat icon="mail" label="Pending invitations" value={pendingInvites} href={`/a/${slug}/members`} />
      </div>
      {canManageMembers(membership.role) && doneCount < steps.length && (
        <section className="card max-w-2xl">
          <h2 className="font-bold">Finish setting up</h2>
          <p className="mt-0.5 text-sm text-muted">
            {doneCount} of {steps.length} done
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-2 divide-y divide-line">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 py-3">
                <span
                  className={`grid size-5.5 shrink-0 place-items-center rounded-full border-2 ${
                    step.done ? "border-brand bg-brand text-white" : "border-line-strong"
                  }`}
                >
                  {step.done && <Icon name="check" className="size-3.5" />}
                </span>
                <span className={`flex-1 text-sm ${step.done ? "text-muted line-through" : ""}`}>{step.label}</span>
                {!step.done && step.href && (
                  <Link href={step.href} className="btn-secondary">Start</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
