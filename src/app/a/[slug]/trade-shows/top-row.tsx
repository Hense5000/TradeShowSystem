"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useFetchAllExhibitors } from "./fetch-exhibitors-all";
import { useFetchNewShows } from "./fetch-new-shows";

/**
 * The row under the Trade shows title: the 3 ad spaces, as big as on the
 * dashboard and lined up with the left edge of the table, and for a platform
 * admin the buttons Add event, Import, Fetch events and Fetch exhibitors
 * stacked in a column to the right. The progress of a fetch shows under the row.
 */
export function TradeShowsTopRow({
  slug,
  ads,
  admin,
}: {
  slug: string;
  ads: React.ReactNode;
  /** Only for a platform admin. Null for a fetch that is not set up (no AI key). */
  admin: { finderCenters: number | null; withoutExhibitors: number | null } | null;
}) {
  return (
    <div className="grid items-center gap-3.5 xl:grid-cols-4">
      <div className="xl:col-span-3">{ads}</div>
      {admin && <AdminButtons slug={slug} {...admin} />}
    </div>
  );
}

function AdminButtons({ slug, finderCenters, withoutExhibitors }: { slug: string; finderCenters: number | null; withoutExhibitors: number | null }) {
  const events = useFetchNewShows(slug, finderCenters ?? 0);
  const exhibitors = useFetchAllExhibitors(slug, withoutExhibitors ?? 0);
  return (
    <>
      <div className="flex flex-wrap gap-2 xl:flex-col">
        <Link href={`/a/${slug}/trade-shows/new`} className="btn py-1.5">
          <Icon name="plus" className="size-4" /> Add event
        </Link>
        <Link href={`/a/${slug}/trade-shows/import`} className="btn py-1.5">
          <Icon name="upload" className="size-4" /> Import
        </Link>
        {finderCenters !== null && events.button}
        {withoutExhibitors !== null && exhibitors.button}
      </div>
      {(events.panel || exhibitors.panel) && (
        <div className="flex flex-col gap-3.5 xl:col-span-4">
          {events.panel}
          {exhibitors.panel}
        </div>
      )}
    </>
  );
}
