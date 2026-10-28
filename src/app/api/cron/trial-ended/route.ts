import { runTrialEndedEmails } from "@/lib/trial-run";

// Called by Vercel Cron every morning (see vercel.json). Emails the owners of
// accounts whose free trial ended without a subscription, with a link to pay.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await runTrialEndedEmails());
}
