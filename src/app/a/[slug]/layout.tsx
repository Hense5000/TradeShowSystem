import { initials } from "@/lib/initials";
import { ROLE_LABEL } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";
import { AccountFrame } from "./sidebar";

export default async function AccountLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug);
  const userName = user.name ?? user.email;

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
            { label: "Features", icon: "grid", path: "features", soon: true },
          ],
        },
        {
          title: "Account settings",
          items: [
            { label: "Company profile", icon: "building", path: "profile", soon: true },
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
