import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-zinc-600">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/accounts" className="btn-secondary mt-6">
        Go to your accounts
      </Link>
    </div>
  );
}
