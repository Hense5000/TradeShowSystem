import { db } from "@/lib/db";
import { initials } from "@/lib/initials";
import { ROLE_LABEL } from "@/lib/permissions";
import { isProfileComplete } from "@/lib/profile";
import { requireMembership } from "@/lib/tenant";
import { AccountFrame } from "./sidebar";

export default async function AccountLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug);
  const userName = user.name ?? user.email;
  const primaryContact = await db.contact.findFirst({ where: { organizationId: organization.id, isPrimary: true } });
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
            { label: "Overview", icon: "home", path: "" },
            { label: "Trade shows", icon: "calendar", path: "trade-shows" },
            { label: "Exhibitors", icon: "store", path: "exhibitors", soon: true },
            { label: "Exhibition centers", icon: "pin", path: "centers" },
            { label: "Exhibition organizers", icon: "briefcase", path: "organizers" },
            { label: "Features", icon: "grid", path: "features", soon: true },
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
            { label: "Users", icon: "users", path: "members" },
            { label: "Billing", icon: "card", path: "billing", soon: true },
          ],
        },
      ]}
    >
      {children}
    </AccountFrame>
  );
}
