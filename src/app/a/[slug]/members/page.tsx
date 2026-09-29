import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { initials } from "@/lib/initials";
import { canAssignRole, canManageMembers, checkRemoval, checkRoleChange, ROLE_LABEL, ROLES } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";
import { changeRole, inviteMember, removeMember, revokeInvitation } from "./actions";
import { InviteForm } from "./invite-form";

const ROLE_HELP = [
  { role: "OWNER", pill: "pill-brand", can: ["Everything an Admin can", "Billing and payment methods", "Delete the account"] },
  { role: "ADMIN", pill: "pill-soft", can: ["Invite and remove users", "Edit the company profile", "Turn features on and off"] },
  { role: "MEMBER", pill: "pill-neutral", can: ["Use the features the account has"] },
] as const;

export default async function MembersPage({ params }: PageProps<"/a/[slug]/members">) {
  const { slug } = await params;
  const { membership: me, organization } = await requireMembership(slug);
  const isAdmin = canManageMembers(me.role);

  const [members, invitations] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    isAdmin
      ? db.invitation.findMany({
          where: { organizationId: organization.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);
  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  return (
    <>
      <PageHeader title="Users" description={`People who can log in to ${organization.name}.`} />

      {isAdmin && (
        <section className="card">
          <h2 className="font-bold">Invite a user</h2>
          <p className="mb-4 text-sm text-muted">They get a link that works for 7 days.</p>
          <InviteForm action={inviteMember.bind(null, slug)} roles={ROLES.filter((r) => canAssignRole(me.role, r))} />
        </section>
      )}

      <section className="card overflow-hidden p-0">
        <h2 className="px-5 pt-5 pb-3 font-bold">
          Members <span className="font-semibold text-muted tabular-nums">{members.length}</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                <th className="px-5 py-2.5">Name</th>
                <th className="px-5 py-2.5">Role</th>
                <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => {
                const isSelf = m.id === me.id;
                const assignable = ROLES.filter(
                  (r) => r === m.role || checkRoleChange({ actor: me.role, target: m.role, next: r, ownerCount }).ok,
                );
                const canRemove = checkRemoval({ actor: me.role, target: m.role, ownerCount, isSelf }).ok;
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-48 items-center gap-2.5">
                        <span className="avatar">{initials(m.user.name ?? m.user.email)}</span>
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {m.user.name ?? m.user.email} {isSelf && <span className="pill pill-neutral ml-1">You</span>}
                          </p>
                          <p className="truncate text-xs text-muted">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {assignable.length > 1 ? (
                        <ActionForm action={changeRole.bind(null, slug, m.id)} className="flex flex-wrap items-center gap-2">
                          <select name="role" defaultValue={m.role} className="input w-auto py-1.5" aria-label={`Role for ${m.user.email}`}>
                            {assignable.map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                          <button className="btn-secondary">Save</button>
                        </ActionForm>
                      ) : (
                        <span className={`pill ${m.role === "OWNER" ? "pill-brand" : m.role === "ADMIN" ? "pill-soft" : "pill-neutral"}`}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canRemove && (
                        <ActionForm
                          action={removeMember.bind(null, slug, m.id)}
                          confirmMessage={isSelf ? `Leave ${organization.name}?` : `Remove ${m.user.email} from ${organization.name}?`}
                        >
                          <button className="btn-danger">{isSelf ? "Leave" : "Remove"}</button>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && invitations.length > 0 && (
        <section className="card overflow-hidden p-0">
          <h2 className="px-5 pt-5 pb-3 font-bold">
            Pending invitations <span className="font-semibold text-muted tabular-nums">{invitations.length}</span>
          </h2>
          <ul className="divide-y divide-line border-t border-line">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{inv.email}</p>
                  <p className="text-xs text-muted">{ROLE_LABEL[inv.role]}</p>
                </div>
                <span className="pill pill-warn">Expires {inv.expiresAt.toISOString().slice(0, 10)}</span>
                <ActionForm action={revokeInvitation.bind(null, slug, inv.id)}>
                  <button className="btn-danger">Revoke</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="mb-4 font-bold">What each role can do</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLE_HELP.map((r) => (
            <div key={r.role} className="space-y-2 rounded-lg border border-line p-3 text-sm">
              <span className={`pill ${r.pill}`}>{ROLE_LABEL[r.role]}</span>
              <ul className="list-disc space-y-0.5 pl-4 text-muted">
                {r.can.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
