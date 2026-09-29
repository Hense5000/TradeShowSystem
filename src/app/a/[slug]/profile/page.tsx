import { CountrySelect, Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { canManageMembers } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";
import { updatePrimaryContact, updateProfile } from "./actions";

export default async function ProfilePage({ params }: PageProps<"/a/[slug]/profile">) {
  const { slug } = await params;
  const { membership, organization: org } = await requireMembership(slug);
  const canEdit = canManageMembers(membership.role);
  const contact = await db.contact.findFirst({ where: { organizationId: org.id, isPrimary: true } });

  return (
    <>
      <PageHeader title="Company profile" description="Used on invoices and when we need to reach you." />
      {!canEdit && (
        <p className="rounded-lg bg-brand-soft px-3 py-2.5 text-sm">
          Only owners and admins can change these details. Ask one of them if something is wrong.
        </p>
      )}

      <SaveForm
        action={updateProfile.bind(null, slug)}
        title="Company"
        description="Name and address appear on your invoices."
        submitLabel="Save changes"
        readOnly={!canEdit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Company name" defaultValue={org.name} autoComplete="organization" required maxLength={100} />
          <Field id="vatNumber" label="VAT / CVR number" defaultValue={org.vatNumber ?? ""} hint="Optional. Needed for EU reverse charge." maxLength={30} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="addressLine1" label="Address" defaultValue={org.addressLine1 ?? ""} autoComplete="address-line1" maxLength={100} />
          <Field id="addressLine2" label="Address line 2" defaultValue={org.addressLine2 ?? ""} autoComplete="address-line2" hint="Optional" maxLength={100} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <Field id="city" label="City" defaultValue={org.city ?? ""} autoComplete="address-level2" maxLength={100} />
          <Field id="postalCode" label="Postal code" defaultValue={org.postalCode ?? ""} autoComplete="postal-code" maxLength={20} />
          <CountrySelect id="country" defaultValue={org.country} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="region" label="State / region" defaultValue={org.region ?? ""} autoComplete="address-level1" hint="Optional" maxLength={100} />
          <Field id="website" label="Website" defaultValue={org.website ?? ""} autoComplete="url" placeholder="example.com" maxLength={200} />
        </div>
      </SaveForm>

      <SaveForm
        action={updatePrimaryContact.bind(null, slug)}
        title="Primary contact"
        description="The person we contact about the account and billing. They do not need to be a user."
        badge={<span className="pill pill-soft">Primary</span>}
        submitLabel="Save contact"
        readOnly={!canEdit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="contact-name" name="name" label="Full name" defaultValue={contact?.name ?? ""} autoComplete="name" required maxLength={100} />
          <Field id="contact-phone" name="phone" label="Phone" type="tel" defaultValue={contact?.phone ?? ""} autoComplete="tel" placeholder="+45 12 34 56 78" hint="Optional" maxLength={30} />
        </div>
        <Field id="contact-email" name="email" label="Email" type="email" defaultValue={contact?.email ?? ""} autoComplete="email" required />
      </SaveForm>
    </>
  );
}
