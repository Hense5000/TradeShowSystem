import Link from "next/link";
import { currentSubscription } from "@/lib/billing";
import { db } from "@/lib/db";
import { initials } from "@/lib/initials";
import { ROLE_LABEL } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { isProfileComplete } from "@/lib/profile";
import { accountAccess, requireMembership } from "@/lib/tenant";
import { daysLeftLabel, TRIAL_DAYS, trialDaysLeft } from "@/lib/trial";
import { AccountFrame } from "./sidebar";

export default async function AccountLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const userName = user.name ?? user.email;
  const platformAdmin = isPlatformAdmin(user.email);
  const { subscriptions } = organization;
  const access = accountAccess(organization, user.email);
  const hasAccess = access !== "none";
  const isOwner = membership.role === "OWNER";
  const [primaryContact, ticketsWaiting] = await Promise.all([
    db.contact.findFirst({ where: { organizationId: organization.id, isPrimary: true } }),
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
                  { label: "Speed check", icon: "dashboard" as const, path: "admin/speed" },
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
      {access === "trial" && organization.trialEndsAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-soft px-3 py-2.5 text-sm print:hidden">
          <p>
            <span className="font-semibold">Free trial: {daysLeftLabel(trialDaysLeft(organization.trialEndsAt))}.</span> Look around as much as you like.
            Downloads (Excel, CSV, CRM, calendar, print) open when you subscribe.
            {!isOwner && " Ask the account owner to subscribe."}
          </p>
          {isOwner && (
            <a href={`/a/${slug}/billing/checkout`} className="btn py-1.5">
              Subscribe
            </a>
          )}
        </div>
      )}
      {!hasAccess ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          {organization.trialEndsAt && !subscriptions.length
            ? `Your ${TRIAL_DAYS} day free trial has ended. Subscribe to keep using Trade Show System.`
            : "This account needs an active subscription to use Trade Show System."}{" "}
          {isOwner ? (
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
            {isOwner ? (
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
      {access === "trial" ? (
        <>
          {/* Printing (and saving as PDF) is not part of the free trial. */}
          <div className="contents print:hidden">{children}</div>
          <p className="hidden print:block">Printing is not part of the free trial. Subscribe to print and download.</p>
        </>
      ) : (
        children
      )}
    </AccountFrame>
  );
}
