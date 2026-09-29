import Image from "next/image";
import Link from "next/link";
import { Logo } from "./logo";

/**
 * Split-screen frame for pages seen before you are inside an account: log in,
 * sign up, the front page and invitation links. Blue brand panel on the left,
 * the form on a white panel on the right.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative flex flex-col justify-between gap-8 overflow-hidden bg-brand px-4 py-7 text-white md:p-12">
        <Link href="/" className="self-start">
          <Logo variant="white" className="h-8 w-auto md:h-10" />
        </Link>
        <div className="relative space-y-3">
          <h2 className="max-w-[18ch] text-2xl leading-tight font-bold text-balance md:text-4xl">
            Everything your team needs for the next trade show.
          </h2>
          <p className="max-w-[40ch] text-white/80">Plan stands, capture leads and keep your exhibitor team in one place.</p>
        </div>
        <Image
          src="/brand/mark-white.png"
          alt=""
          width={156}
          height={156}
          className="pointer-events-none absolute -right-24 -bottom-24 hidden size-96 opacity-15 md:block"
        />
      </aside>
      <section className="flex items-center justify-center bg-surface px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}
