import "server-only";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import type { ShowOption } from "./show-picker";

export { type ShowOption, ShowSelect } from "./show-picker";

/** Trade shows for a picker, newest first, labelled with their dates. */
export async function tradeShowOptions(): Promise<ShowOption[]> {
  const shows = await db.tradeShow.findMany({
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });
  return shows.map((s) => ({ id: s.id, label: `${s.name} (${formatDateRange(s.startDate, s.endDate)})` }));
}
