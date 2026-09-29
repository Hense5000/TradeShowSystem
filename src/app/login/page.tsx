import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const next = typeof callbackUrl === "string" ? callbackUrl : undefined;
  // Coming from an invite link: sign up through the invitation instead.
  const inviteToken = next?.match(/^\/invite\/([\w-]+)$/)?.[1];
  const signupHref = inviteToken ? `/signup?invite=${inviteToken}` : "/signup";
  return (
    <AuthShell>
      <h1 className="page-title">Log in</h1>
      <p className="mt-1 mb-6 text-muted">Welcome back.</p>
      <LoginForm callbackUrl={next} />
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href={signupHref} className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
