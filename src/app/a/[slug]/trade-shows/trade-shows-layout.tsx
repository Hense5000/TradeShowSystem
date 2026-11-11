"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useFetchAllExhibitors } from "./fetch-exhibitors-all";
import { useFetchNewShows } from "./fetch-new-shows";

// The column of admin buttons on a wide screen.
const BUTTONS_WIDTH = "xl:w-44 xl:shrink-0";

type Admin = { finderCenters: number | null; withoutExhibitors: number | null };

/**
 * The Trade shows page under its title: a row of 4 ad spaces as wide as the
 * table, then the notices, then the table. For a platform admin
 * the buttons Add event, Import, Fetch events and Fetch exhibitors stand in a
 * column to the right of the table, the first one level with the table's top
 * edge; on a narrow screen they come above the table. The progress of a fetch
 * shows above the table.
 */
export function TradeShowsLayout({
  slug,
  ads,
  notices,
  admin,
  children,
}: {
  slug: string;
  ads: React.ReactNode;
  /** Cards between the ads and the table, e.g. "trade shows have no organizer". */
  notices?: React.ReactNode;
  /** Only for a platform admin. Null for a fetch that is not set up (no AI key). */
  admin: Admin | null;
  /** The table (or the "No trade shows yet" card). */
  children: React.ReactNode;
}) {
  if (!admin)
    return (
      <>
        {ads}
        {notices}
        {children}
      </>
    );
  return (
    <AdminLayout slug={slug} ads={ads} notices={notices} admin={admin}>
      {children}
    </AdminLayout>
  );
}

function AdminLayout({ slug, ads, notices, admin, children }: { slug: string; ads: React.ReactNode; notices?: React.ReactNode; admin: Admin; children: React.ReactNode }) {
  const events = useFetchNewShows(slug, admin.finderCenters ?? 0);
  const exhibitors = useFetchAllExhibitors(slug, admin.withoutExhibitors ?? 0);
  return (
    <>
      {/* The ads span the table's width: the same column, with an empty space as wide as the buttons beside them. */}
      <div className="flex gap-3.5">
        <div className="min-w-0 flex-1">{ads}</div>
        <div className={`hidden xl:block ${BUTTONS_WIDTH}`} />
      </div>
      {notices}
      {events.panel}
      {exhibitors.panel}
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
        <div className={`flex flex-wrap gap-2 xl:order-2 xl:flex-col ${BUTTONS_WIDTH}`}>
          <Link href={`/a/${slug}/trade-shows/new`} className="btn px-3 py-1.5">
            <Icon name="plus" className="size-4" /> Add event
          </Link>
          <Link href={`/a/${slug}/trade-shows/import`} className="btn px-3 py-1.5">
            <Icon name="upload" className="size-4" /> Import
          </Link>
          {admin.finderCenters !== null && events.button}
          {admin.withoutExhibitors !== null && exhibitors.button}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
