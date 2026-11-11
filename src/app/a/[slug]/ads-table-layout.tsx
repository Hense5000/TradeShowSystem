/**
 * A list page under its title: a row of 4 ad spaces as wide as the table,
 * then the notices, then the table with the page's buttons in a narrow column
 * to its right, the first one level with the table's top edge. On a narrow
 * screen the buttons come above the table. With no buttons (e.g. a page whose
 * buttons are only for the platform admin), the ads and table use the full width.
 * Used by the Exhibitors, Saved lists, Exhibition centers and Exhibition
 * organizers pages; the Trade shows page has the same layout.
 */
export function AdsTableLayout({
  ads,
  notices,
  buttons,
  buttonsWidth = "xl:w-44",
  children,
}: {
  ads: React.ReactNode;
  /** Notes between the ads and the table, e.g. where a trade show's list comes from. */
  notices?: React.ReactNode;
  /** The page's buttons; leave out when there are none. */
  buttons?: React.ReactNode;
  /** The column's width on a wide screen. */
  buttonsWidth?: string;
  /** The table (or the "No … yet" card). */
  children: React.ReactNode;
}) {
  if (!buttons)
    return (
      <>
        {ads}
        {notices}
        {children}
      </>
    );
  const column = `${buttonsWidth} xl:shrink-0`;
  return (
    <>
      {/* The ads span the table's width: the same column, with an empty space as wide as the buttons beside them. */}
      <div className="flex gap-3.5">
        <div className="min-w-0 flex-1">{ads}</div>
        <div className={`hidden xl:block ${column}`} />
      </div>
      {notices}
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
        <div className={`flex flex-wrap gap-2 xl:order-2 xl:flex-col ${column}`}>{buttons}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">{children}</div>
      </div>
    </>
  );
}
