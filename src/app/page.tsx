import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  if ((await auth())?.user) redirect("/accounts");
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-3xl font-semibold">Trade Show System</h1>
      <p className="mt-3 text-zinc-600">Create an account for your company and invite your team.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/signup" className="btn">
          Create an account
        </Link>
        <Link href="/login" className="btn-secondary">
          Log in
        </Link>
      </div>
    </div>
  );
}
