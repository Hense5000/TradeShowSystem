"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/logo";
import { logout } from "../../logout-action";

type NavItem = { label: string; icon: IconName; path: string; soon?: boolean; badge?: React.ReactNode };
type NavGroup = { title?: string; items: NavItem[] };

/** Which navigation item a path belongs to ("" is the dashboard). */
function currentPath(pathname: string, base: string): string {
  return pathname.slice(base.length).split("/")[1] ?? "";
}

export function AccountFrame({
  base,
  accountName,
  accountInitials,
  userName,
  userInitials,
  roleLabel,
  groups,
  children,
}: {
  base: string;
  accountName: string;
  accountInitials: string;
  userName: string;
  userInitials: string;
  roleLabel: string;
  groups: NavGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = currentPath(pathname, base);
  const activeItem = groups.flatMap((g) => g.items).find((i) => i.path === active);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_minmax(0,1fr)]">
      {/* Mobile top bar */}
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setOpen(!open)} className="p-1">
          <Icon name="menu" className="size-6" />
        </button>
        <Logo className="h-6 w-auto" />
      </div>
      {open && <div className="fixed inset-0 z-30 bg-ink/40 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col gap-5 border-r border-line bg-surface px-3.5 py-5 transition-transform md:sticky md:top-0 md:h-screen md:w-auto md:translate-x-0 ${
          open ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <Link href="/accounts" className="px-2">
          <Logo className="h-9 w-auto" />
        </Link>
        <Link
          href="/accounts"
          className="flex items-center gap-2.5 rounded-lg border border-line bg-subtle p-2 hover:border-line-strong"
        >
          <span className="avatar rounded-lg">{accountInitials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{accountName}</span>
            <span className="block text-xs text-muted">Switch account</span>
          </span>
          <Icon name="chevron" className="size-4 text-muted" />
        </Link>

        <nav className="flex flex-col gap-1">
          {groups.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-1">
              {group.title && (
                <p className="px-3 pt-3 pb-1 text-[0.68rem] font-semibold tracking-widest text-faint uppercase">{group.title}</p>
              )}
              {group.items.map((item) => {
                const isActive = item.path === active;
                const inner = (
                  <>
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    {item.soon ? (
                      <span className="ml-auto text-[0.68rem] font-semibold text-faint">Soon</span>
                    ) : (
                      item.badge && <span className="ml-auto">{item.badge}</span>
                    )}
                  </>
                );
                const cls = "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
                if (item.soon) {
                  return (
                    <span key={item.path} className={`${cls} cursor-not-allowed text-faint`} title="Coming soon">
                      {inner}
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.path}
                    href={item.path ? `${base}/${item.path}` : base}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`${cls} ${
                      isActive
                        ? "bg-brand font-semibold text-white shadow-[0_4px_12px_rgba(40,123,191,0.28)]"
                        : "text-muted hover:bg-subtle hover:text-ink"
                    }`}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-line pt-3">
          <form action={logout}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-bad hover:bg-bad-soft">
              <Icon name="logout" />
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-line bg-surface px-8 py-3.5 md:flex">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
            <span className="truncate">{accountName}</span>
            <span className="text-faint">/</span>
            <span className="font-bold text-ink">{activeItem?.label ?? "Dashboard"}</span>
          </p>
          <div className="flex items-center gap-2.5 border-l border-line pl-4">
            <span className="avatar">{userInitials}</span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{userName}</span>
              <span className="block text-xs text-muted">{roleLabel}</span>
            </span>
          </div>
        </header>
        <main className="flex w-full max-w-[1120px] min-w-0 flex-col gap-5 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </div>
    </div>
  );
}
