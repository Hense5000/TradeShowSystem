import "server-only";
import { db } from "@/lib/db";

/** The centers and organizers the trade show form can pick from, by name. */
export async function tradeShowPickerOptions() {
  const [centers, organizers] = await Promise.all([
    db.exhibitionCenter.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
    db.exhibitionOrganizer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    centers: centers.map((c) => ({ id: c.id, label: c.city ? `${c.name} (${c.city})` : c.name })),
    organizers: organizers.map((o) => ({ id: o.id, label: o.name })),
  };
}

export type TradeShowPickerOptions = Awaited<ReturnType<typeof tradeShowPickerOptions>>;
