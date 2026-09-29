import Link from "next/link";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireUser } from "@/lib/tenant";
import { CreateAccountForm } from "./create-account-form";

export default async function AccountsPage() {
  const user = await requireUser("/accounts");
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your accounts</h1>
        <p className="mt-1 text-sm text-zinc-600">Pick the company account you want to work in.</p>
      </div>
      {memberships.length === 0 ? (
        <p className="card text-sm text-zinc-600">You are not part of any account yet. Create one below, or ask a colleague to invite you.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link href={`/a/${m.organization.slug}`} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50">
                <span className="font-medium">{m.organization.name}</span>
                <span className="text-sm text-zinc-500">{ROLE_LABEL[m.role]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="card">
        <h2 className="mb-3 font-medium">Create another account</h2>
        <CreateAccountForm />
      </div>
    </div>
  );
}
