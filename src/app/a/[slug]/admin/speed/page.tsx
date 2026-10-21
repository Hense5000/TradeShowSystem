import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { NO_FILTERS } from "@/lib/exhibitor-list";
import { companyPage } from "@/lib/exhibitor-list-run";
import { median, NEON_REGIONS, neonRegion, VERCEL_REGIONS } from "@/lib/speed-check";
import { requirePlatformAdmin } from "@/lib/tenant";

async function timed<T>(run: () => Promise<T>): Promise<number> {
  const start = performance.now();
  await run();
  return Math.round(performance.now() - start);
}

function Row({ label, value, note, ok }: { label: string; value: string; note?: string; ok?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line px-5 py-3 first:border-t-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right">
        <span className={`font-semibold ${ok === false ? "text-bad" : ok ? "text-ok" : ""}`}>{value}</span>
        {note && <span className="block text-xs text-muted">{note}</span>}
      </span>
    </div>
  );
}

export default async function SpeedCheckPage({ params }: PageProps<"/a/[slug]/admin/speed">) {
  const { slug } = await params;
  const requestStart = performance.now();
  await requirePlatformAdmin(slug);

  // Five tiny queries one after another: the first may also wake the database.
  const trips: number[] = [];
  for (let i = 0; i < 5; i++) trips.push(await timed(() => db.$queryRaw`SELECT 1`));
  const trip = median(trips.slice(1));
  const listTime = await timed(() => companyPage(NO_FILTERS, 1, 50));
  const total = Math.round(performance.now() - requestStart);

  const serverCode = process.env.VERCEL_REGION ?? "";
  // The Neon integration also sets the bare host name (PGHOST); either one names the region.
  const dbCode = neonRegion(process.env.DATABASE_URL) ?? neonRegion(process.env.PGHOST && `postgresql://${process.env.PGHOST}`);
  const dbRegion = dbCode ? NEON_REGIONS[dbCode] : undefined;
  const sameRegion = dbRegion && serverCode ? dbRegion.vercel === serverCode : undefined;
  const best = dbRegion ? `${VERCEL_REGIONS[dbRegion.vercel]} (${dbRegion.vercel})` : "";

  return (
    <>
      <PageHeader title="Speed check" description="Where the app and its database run, and how long the database takes to answer. Reload the page to measure again." />

      {sameRegion === false && (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          The app and the database are in different places, so every database query has to travel between them. In Vercel, open the project → Settings → Functions → Function Region, choose <strong>{best}</strong>, save, and deploy again.
        </p>
      )}

      <section className="card p-0">
        <Row label="App server (Vercel)" value={serverCode ? `${VERCEL_REGIONS[serverCode] ?? serverCode} (${serverCode})` : "Unknown (not running on Vercel)"} />
        <Row
          label="Database (Neon)"
          value={dbRegion ? `${dbRegion.place} (${dbCode})` : dbCode ?? "Unknown"}
          note={sameRegion === false ? `Best app region for it: ${best}` : undefined}
        />
        <Row
          label="Same place"
          value={sameRegion === undefined ? "Can't tell" : sameRegion ? "Yes" : "No"}
          ok={sameRegion}
          note={sameRegion === false ? "This makes every page slower" : undefined}
        />
        <Row
          label="One database query"
          value={`${trip} ms`}
          ok={trip <= 20}
          note={trip <= 20 ? "Good" : trip <= 60 ? "A little slow" : "Slow: pages make many queries, so this adds up"}
        />
        <Row
          label="First query on this page"
          value={`${trips[0]} ms`}
          note={trips[0] > 300 ? "The database was asleep and had to wake up (Neon's free plan sleeps after 5 minutes without use)" : undefined}
        />
        <Row label="Exhibitors list, first 50 companies" value={`${listTime} ms`} ok={listTime <= 500} />
        <Row label="This whole page" value={`${total} ms`} />
      </section>
    </>
  );
}
