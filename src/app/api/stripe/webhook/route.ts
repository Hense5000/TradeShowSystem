import { handleStripeEvent, stripe } from "@/lib/stripe";

// Stripe calls this when a subscription or invoice changes. Set it up in the
// Stripe dashboard (Developers → Webhooks) with the URL
// https://<your domain>/api/stripe/webhook and put its signing secret in
// STRIPE_WEBHOOK_SECRET.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe is not set up" }, { status: 503 });
  }
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  // The signature covers the raw body, so it must be read as text.
  const body = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const handled = await handleStripeEvent(event);
    return Response.json({ received: true, duplicate: !handled });
  } catch (error) {
    console.error(`Stripe event ${event.id} (${event.type}) failed`, error);
    // A 500 makes Stripe send the event again later.
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
