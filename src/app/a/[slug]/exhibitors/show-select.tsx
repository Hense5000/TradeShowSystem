import "server-only";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";

export type ShowOption = { id: string; label: string };

/** Trade shows for a picker, newest first, labelled with their dates. */
export async function tradeShowOptions(): Promise<ShowOption[]> {
  const shows = await db.tradeShow.findMany({
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });
  return shows.map((s) => ({ id: s.id, label: `${s.name} (${formatDateRange(s.startDate, s.endDate)})` }));
}

/** A labelled, required trade show picker for forms. */
export function ShowSelect({ shows, defaultValue }: { shows: ShowOption[]; defaultValue?: string }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor="tradeShowId">Trade show</label>
      <select className="input" id="tradeShowId" name="tradeShowId" defaultValue={defaultValue ?? ""} required>
        <option value="" disabled>Choose a trade show</option>
        {shows.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
