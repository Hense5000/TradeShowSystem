import Link from "next/link";
import { requireMembership } from "@/lib/tenant";

export default async function AccountLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const { slug } = await params;
  const { organization } = await requireMembership(slug);
  const base = `/a/${slug}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <Link href="/accounts" className="text-sm text-zinc-500 hover:underline">
            All accounts
          </Link>
          <h1 className="text-2xl font-semibold">{organization.name}</h1>
        </div>
        <nav className="flex gap-1 text-sm">
          <Link href={base} className="btn-secondary">Overview</Link>
          <Link href={`${base}/members`} className="btn-secondary">Users</Link>
          {/* Coming in the next steps */}
          <span className="btn-secondary cursor-not-allowed opacity-40" title="Coming soon">Profile</span>
          <span className="btn-secondary cursor-not-allowed opacity-40" title="Coming soon">Billing</span>
          <span className="btn-secondary cursor-not-allowed opacity-40" title="Coming soon">Features</span>
        </nav>
      </div>
      {children}
    </div>
  );
}
