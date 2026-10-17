import { runListDigest } from "@/lib/list-digest-run";

// Called by Vercel Cron every morning (see vercel.json). Emails each user
// what is new on their accounts' saved lists.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await runListDigest());
}
