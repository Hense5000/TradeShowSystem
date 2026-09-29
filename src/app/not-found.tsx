import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-20 text-center">
      <Logo className="h-9 w-auto" />
      <div className="card w-full space-y-2">
        <h1 className="text-xl font-bold">Not found</h1>
        <p className="text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
        <Link href="/accounts" className="btn-secondary mt-4">Go to your accounts</Link>
      </div>
    </div>
  );
}
