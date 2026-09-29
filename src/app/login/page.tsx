import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl } = await searchParams;
  const next = typeof callbackUrl === "string" ? callbackUrl : undefined;
  // Coming from an invite link: sign up through the invitation instead.
  const inviteToken = next?.match(/^\/invite\/([\w-]+)$/)?.[1];
  const signupHref = inviteToken ? `/signup?invite=${inviteToken}` : "/signup";
  return (
    <div className="card mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-semibold">Log in</h1>
      <LoginForm callbackUrl={next} />
      <p className="mt-6 text-sm text-zinc-600">
        No account yet?{" "}
        <Link href={signupHref} className="font-medium underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
