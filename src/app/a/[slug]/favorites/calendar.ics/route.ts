import { appUrl } from "@/lib/app-url";
import { icsCalendar } from "@/lib/calendar";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import { accountAccess, requireMembership } from "@/lib/tenant";

// "Add to calendar" on the Favorites calendar: the account's favorite trade
// shows as an .ics file, which Outlook, Google Calendar and Apple Calendar import.
// Not during the free trial, where the button opens the trial dialog instead.
export async function GET(_request: Request, { params }: RouteContext<"/a/[slug]/favorites/calendar.ics">) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug);
  if (accountAccess(organization, user.email) === "trial") {
    return new Response("Downloads are not part of the free trial.", { status: 402 });
  }
  const favorites = await db.favoriteShow.findMany({
    where: { organizationId: organization.id },
    include: { tradeShow: { include: { center: { select: { name: true } } } } },
    orderBy: { tradeShow: { startDate: "asc" } },
  });
  const plan = `${appUrl()}/a/${slug}/favorites/plan?show=`;
  const ics = icsCalendar(
    `${organization.name} favorite trade shows`,
    favorites.map(({ tradeShow: s }) => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      location: [s.center?.name, s.city, s.country && countryName(s.country)].filter(Boolean).join(", "),
      url: s.website,
      description: `Meeting plan in Trade Show System: ${plan}${s.id}`,
    })),
    new Date(),
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="favorite-trade-shows.ics"`,
    },
  });
}
