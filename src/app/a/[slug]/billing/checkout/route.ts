import { redirect } from "next/navigation";
import { createCheckout } from "@/lib/checkout";
import { requireMembership } from "@/lib/tenant";

// Where a new account lands right after sign-up: straight on to Stripe to
// enter a card and pay. If that can't start, the Billing page explains why
// and has the Subscribe button.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug, "OWNER", { allowUnpaid: true });
  const checkout = await createCheckout(organization, user.email, slug);
  redirect("url" in checkout ? checkout.url : `/a/${slug}/billing`);
}
