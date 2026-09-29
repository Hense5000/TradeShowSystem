import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/db";
import { canAssignRole, canManageMembers, checkRemoval, checkRoleChange, ROLE_LABEL, ROLES } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";
import { changeRole, inviteMember, removeMember, revokeInvitation } from "./actions";
import { InviteForm } from "./invite-form";

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
    <div className="space-y-8">
      {isAdmin && (
        <section className="card">
          <h2 className="mb-3 font-medium">Invite a user</h2>
          <InviteForm action={inviteMember.bind(null, slug)} roles={ROLES.filter((r) => canAssignRole(me.role, r))} />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-medium">Users ({members.length})</h2>
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {members.map((m) => {
            const isSelf = m.id === me.id;
            const assignable = ROLES.filter(
              (r) => r === m.role || checkRoleChange({ actor: me.role, target: m.role, next: r, ownerCount }).ok,
            );
            const canRemove = checkRemoval({ actor: me.role, target: m.role, ownerCount, isSelf }).ok;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.user.name ?? m.user.email} {isSelf && <span className="text-sm text-zinc-500">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-zinc-500">{m.user.email}</p>
                </div>
                {assignable.length > 1 ? (
                  <ActionForm action={changeRole.bind(null, slug, m.id)} className="flex flex-wrap items-center gap-2">
                    <select name="role" defaultValue={m.role} className="input w-auto" aria-label="Role">
                      {assignable.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                    <button className="btn-secondary">Save</button>
                  </ActionForm>
                ) : (
                  <span className="text-sm text-zinc-600">{ROLE_LABEL[m.role]}</span>
                )}
                {canRemove && (
                  <ActionForm
                    action={removeMember.bind(null, slug, m.id)}
                    confirmMessage={isSelf ? `Leave ${organization.name}?` : `Remove ${m.user.email} from ${organization.name}?`}
                  >
                    <button className="btn-secondary text-red-700">{isSelf ? "Leave" : "Remove"}</button>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin && invitations.length > 0 && (
        <section>
          <h2 className="mb-3 font-medium">Pending invitations</h2>
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-sm text-zinc-500">
                    {ROLE_LABEL[inv.role]} · expires {inv.expiresAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <ActionForm action={revokeInvitation.bind(null, slug, inv.id)}>
                  <button className="btn-secondary">Revoke</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
