import { db } from "@/lib/db";
import { visibleFeaturesWhere } from "@/lib/features";
import { initials } from "@/lib/initials";
import { ROLE_LABEL } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { isProfileComplete } from "@/lib/profile";
import { requireMembership } from "@/lib/tenant";
import { AccountFrame } from "./sidebar";

export default async function AccountLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug);
  const userName = user.name ?? user.email;
  const [primaryContact, featureCount] = await Promise.all([
    db.contact.findFirst({ where: { organizationId: organization.id, isPrimary: true } }),
    db.feature.count({ where: visibleFeaturesWhere(organization.id) }),
  ]);
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
            { label: "Exhibition centers", icon: "pin", path: "centers" },
            { label: "Exhibition organizers", icon: "briefcase", path: "organizers" },
            { label: "Features", icon: "grid", path: "features", soon: featureCount === 0 },
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
        // Only the platform admins in PLATFORM_ADMIN_EMAILS see this group.
        ...(isPlatformAdmin(user.email)
          ? [{ title: "Super admin", items: [{ label: "Feature control", icon: "shield" as const, path: "admin" }] }]
          : []),
      ]}
    >
      {children}
    </AccountFrame>
  );
}
