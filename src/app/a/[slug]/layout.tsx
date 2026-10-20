import Link from "next/link";
import { currentSubscription } from "@/lib/billing";
import { db } from "@/lib/db";
import { initials } from "@/lib/initials";
import { ROLE_LABEL } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { isProfileComplete } from "@/lib/profile";
import { accountHasAccess, requireMembership, subscriptionsOf } from "@/lib/tenant";
import { AccountFrame } from "./sidebar";

export default async function AccountLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const userName = user.name ?? user.email;
  const platformAdmin = isPlatformAdmin(user.email);
  const [primaryContact, hasAccess, subscriptions, ticketsWaiting] = await Promise.all([
    db.contact.findFirst({ where: { organizationId: organization.id, isPrimary: true } }),
    accountHasAccess(organization.id, user.email),
    subscriptionsOf(organization.id),
    platformAdmin ? db.supportTicket.count({ where: { status: "OPEN", waitingOnSupport: true } }) : 0,
  ]);
  const paymentFailed = currentSubscription(subscriptions)?.status === "past_due";
  const profileMissing = !isProfileComplete(organization, primaryContact);

  return (
    <AccountFrame
      base={`/a/${slug}`}
      accountName={organization.name}
      accountInitials={initials(organization.name)}
      userName={userName}
      userInitials={initials(userName)}
      roleLabel={ROLE_LABEL[membership.role]}
      groups={[
        {
          items: [
            { label: "Dashboard", icon: "dashboard", path: "" },
            { label: "Trade shows", icon: "calendar", path: "trade-shows" },
            { label: "Exhibitors", icon: "store", path: "exhibitors" },
            { label: "Favorites", icon: "star", path: "favorites", children: [
                { label: "Exhibitors", icon: "store", path: "favorites/exhibitors" },
                { label: "Trade shows", icon: "calendar", path: "favorites/trade-shows" },
                { label: "Calendar", icon: "calendar", path: "favorites/calendar" },
              ],
            },
            { label: "Saved lists", icon: "bookmark", path: "lists" },
            { label: "Exhibition centers", icon: "pin", path: "centers" },
            { label: "Exhibition organizers", icon: "briefcase", path: "organizers" },
          ],
        },
        {
          title: "Account settings",
          items: [
            {
              label: "Company profile",
              icon: "building",
              path: "profile",
              badge: profileMissing ? <span className="block size-2 rounded-full bg-warn" title="Details missing" /> : undefined,
            },
            { label: "Support", icon: "help", path: "support" },
            { label: "Users", icon: "users", path: "members" },
            { label: "Billing", icon: "card", path: "billing" },
          ],
        },
        // Only the platform admins in PLATFORM_ADMIN_EMAILS see this group.
        ...(platformAdmin
          ? [
              {
                title: "Super admin",
                items: [
                  { label: "Feature control", icon: "shield" as const, path: "admin" },
                  {
                    label: "Support requests",
                    icon: "help" as const,
                    path: "admin/support",
                    badge: ticketsWaiting > 0 ? <span className="pill pill-warn" title="Waiting for an answer">{ticketsWaiting}</span> : undefined,
                  },
                ],
              },
            ]
          : []),
      ]}
    >
      {!hasAccess ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          This account needs an active subscription to use Trade Show System.{" "}
          {membership.role === "OWNER" ? (
            <>
              Start it on the{" "}
              <Link href={`/a/${slug}/billing`} className="font-semibold underline">
                Billing page
              </Link>
              .
            </>
          ) : (
            "Ask the account owner to start it."
          )}
        </p>
      ) : (
        paymentFailed && (
          <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
            The last payment failed.{" "}
            {membership.role === "OWNER" ? (
              <Link href={`/a/${slug}/billing`} className="font-semibold underline">
                Update your card
              </Link>
            ) : (
              "Ask the account owner to update the card"
            )}{" "}
            to keep using Trade Show System.
          </p>
        )
      )}
      {children}
    </AccountFrame>
  );
}
