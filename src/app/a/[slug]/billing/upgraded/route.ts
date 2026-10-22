import { redirect } from "next/navigation";
import { currentSubscription } from "@/lib/billing";
import { syncSubscription } from "@/lib/stripe";
import { requireMembership } from "@/lib/tenant";

// Back from upgrading (src/app/a/[slug]/billing/actions.ts): copy the changed
// subscription right away instead of waiting for the webhook, so the higher
// download limit works at once, then show the Billing page's thank-you note.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const sub = currentSubscription(organization.subscriptions);
  if (sub) {
    try {
      await syncSubscription(sub.stripeSubscriptionId);
    } catch (error) {
      console.error("Could not read the upgraded subscription", error);
    }
  }
  const back = new URL(request.url).searchParams.get("back") ?? "";
  const returnTo = back.startsWith(`/a/${slug}/`) ? back : `/a/${slug}/exhibitors`;
  redirect(`/a/${slug}/billing?upgraded=1&back=${encodeURIComponent(returnTo)}`);
}
