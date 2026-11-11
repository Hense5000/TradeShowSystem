// The column of buttons on a wide screen; a little wider than on the Trade shows page so "Find missing contacts" fits.
const BUTTONS_WIDTH = "xl:w-52 xl:shrink-0";

/**
 * The Exhibitors page under its title: a row of 4 ad spaces as wide as the
 * table, then the notices, then the table with the page's buttons (Excel,
 * CSV, Import, Add exhibitor, Find missing contacts) in a column to its right, the first one level
 * with the table's top edge. On a narrow screen the buttons come above the
 * table. The same layout as the Trade shows page.
 */
export function ExhibitorsLayout({
  ads,
  notices,
  buttons,
  children,
}: {
  ads: React.ReactNode;
  /** A note between the ads and the table, e.g. where a trade show's list comes from. */
  notices?: React.ReactNode;
  buttons: React.ReactNode;
  /** The table (or the "No exhibitors yet" card). */
  children: React.ReactNode;
}) {
  return (
    <>
      {/* The ads span the table's width: the same column, with an empty space as wide as the buttons beside them. */}
      <div className="flex gap-3.5">
        <div className="min-w-0 flex-1">{ads}</div>
        <div className={`hidden xl:block ${BUTTONS_WIDTH}`} />
      </div>
      {notices}
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
        <div className={`flex flex-wrap gap-2 xl:order-2 xl:flex-col ${BUTTONS_WIDTH}`}>{buttons}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">{children}</div>
      </div>
    </>
  );
}
