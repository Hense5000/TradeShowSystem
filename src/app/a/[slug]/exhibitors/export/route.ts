import { countryName } from "@/lib/countries";
import { crmTable } from "@/lib/crm-export";
import { db } from "@/lib/db";
import { exhibitorFilters, exhibitorWhere } from "@/lib/exhibitor-list";
import { favoriteFilters, favoriteWhere, LEAD_LABEL } from "@/lib/leads";
import { type Table, toCsv, toXlsx } from "@/lib/spreadsheet";
import { requireMembership } from "@/lib/tenant";

// A large export can take a while to read and pack.
export const maxDuration = 60;

/**
 * Downloads the exhibitors the Exhibitors page shows with the same search and
 * filters, as Excel (?format=xlsx, the default) or CSV (?format=csv). Every
 * member of the account may export. The column names match the CSV import, so
 * a file can be imported again. With ?list=<id> it downloads one of the
 * account's saved lists instead. For the Favorites list it also takes the
 * Favorites page's filters (?q, ?show, ?status) and adds the status and notes;
 * with ?layout=crm it has the columns a CRM such as HubSpot, Pipedrive or
 * Salesforce imports (see src/lib/crm-export.ts).
 */
export async function GET(request: Request, { params }: RouteContext<"/a/[slug]/exhibitors/export">) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug);

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const filters = exhibitorFilters(url.searchParams);
  const listId = url.searchParams.get("list");
  const list = listId ? await db.savedList.findFirst({ where: { id: listId, organizationId: organization.id } }) : null;
  if (listId && !list) return new Response("Not found", { status: 404 });

  const leads = list?.favorites;
  const exhibitors = await db.exhibitor.findMany({
    where: leads
      ? { savedIn: { some: favoriteWhere(list.id, favoriteFilters(url.searchParams), { userId: user.id }) } }
      : list
        ? { savedIn: { some: { listId: list.id } } }
        : exhibitorWhere(filters),
    include: {
      tradeShow: { select: { name: true, startDate: true, endDate: true, city: true } },
      // The lead details on the Favorites list (none for other exports).
      savedIn: {
        where: { listId: leads ? list.id : "" },
        select: { leadStatus: true, leadNote: true, followUpAt: true, followUpNote: true, assignee: { select: { name: true, email: true } } },
      },
    },
    orderBy: [{ name: "asc" }, { tradeShow: { startDate: "asc" } }],
  });

  const day = (d: Date) => d.toISOString().slice(0, 10);
  const crm = leads && url.searchParams.get("layout") === "crm";
  const table: Table = crm ? crmTable(exhibitors) : {
    headers: [
      "Company Name",
      "Trade Show",
      "Show Start",
      "Show End",
      "Show City",
      "Contact Person",
      "Contact Position",
      "Email",
      "Phone",
      "Website",
      "Country",
      "Industry",
      "Booth No.",
      "Stand Location URL",
      "Company Profile",
      ...(leads ? ["Lead Status", "Responsible", "Notes", "Follow-up Date", "Follow-up Reminder"] : []),
    ],
    rows: exhibitors.map((e) => [
      e.name,
      e.tradeShow.name,
      day(e.tradeShow.startDate),
      day(e.tradeShow.endDate),
      e.tradeShow.city,
      e.contactName,
      e.contactTitle,
      e.email,
      e.phone,
      e.website,
      e.country && countryName(e.country),
      e.industry,
      e.boothNumber,
      e.standLocationUrl,
      e.companyProfile,
      ...(leads
        ? [
            e.savedIn[0] && LEAD_LABEL[e.savedIn[0].leadStatus],
            e.savedIn[0]?.assignee && (e.savedIn[0].assignee.name ?? e.savedIn[0].assignee.email),
            e.savedIn[0]?.leadNote,
            e.savedIn[0]?.followUpAt && day(e.savedIn[0].followUpAt),
            e.savedIn[0]?.followUpNote,
          ]
        : []),
    ]),
  };

  // Named after the saved list, or the trade show when the list is for one show,
  // e.g. "exhibitors-london-biotech-show-2026-10-17.xlsx".
  const showName = list ? list.name : filters.show ? exhibitors[0]?.tradeShow.name : undefined;
  const slugged = showName?.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `${crm ? "crm-leads" : `exhibitors${slugged ? `-${slugged}` : ""}`}-${day(new Date())}.${format}`;

  const body = format === "csv" ? toCsv(table) : new Uint8Array(toXlsx(table, crm ? "Leads" : list ? list.name : "Exhibitors"));
  return new Response(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
