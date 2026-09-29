import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Show System",
  description: "Accounts, users and billing for Trade Show System customers.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href={session ? "/accounts" : "/"} className="font-semibold">
              Trade Show System
            </Link>
            {session?.user ? (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-500">{session.user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="btn-secondary">Log out</button>
                </form>
              </div>
            ) : (
              <div className="flex gap-2 text-sm">
                <Link href="/login" className="btn-secondary">
                  Log in
                </Link>
                <Link href="/signup" className="btn">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
