import Link from "next/link";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { db } from "@/lib/db";
import { initials } from "@/lib/initials";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireUser } from "@/lib/tenant";
import { logout } from "../logout-action";
import { CreateAccountForm } from "./create-account-form";

export default async function AccountsPage() {
  const user = await requireUser("/accounts");
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: { include: { _count: { select: { memberships: true } } } } },
    orderBy: { organization: { name: "asc" } },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <Logo className="h-8 w-auto" />
        <form action={logout}>
          <button className="btn-secondary">Log out</button>
        </form>
      </div>
      <div>
        <h1 className="page-title">Choose an account</h1>
        <p className="mt-1 text-muted">
          {memberships.length === 1 ? "You are a member of 1 account." : `You are a member of ${memberships.length} accounts.`}
        </p>
      </div>
      {memberships.length === 0 ? (
        <p className="card text-sm text-muted">You are not part of any account yet. Create one below, or ask a colleague to invite you.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link href={`/a/${m.organization.slug}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-brand-soft">
                <span className="avatar size-9 rounded-lg text-sm">{initials(m.organization.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.organization.name}</span>
                  <span className="text-xs text-muted">
                    {m.organization._count.memberships} {m.organization._count.memberships === 1 ? "user" : "users"}
                  </span>
                </span>
                <span className="pill pill-neutral">{ROLE_LABEL[m.role]}</span>
                <Icon name="chevron" className="size-4 -rotate-90 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="card">
        <h2 className="mb-3 font-bold">Create another account</h2>
        <CreateAccountForm />
      </div>
    </div>
  );
}
