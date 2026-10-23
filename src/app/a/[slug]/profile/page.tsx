import { CountrySelect, Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { EMAIL_BENEFITS, MAX_EMAIL_BENEFIT, MAX_EMAIL_OFFER } from "@/lib/email-draft";
import { canManageMembers } from "@/lib/permissions";
import { CURRENCIES, CURRENCY_LABEL } from "@/lib/project-value";
import { requireMembership } from "@/lib/tenant";
import { updateEmailIntro, updatePrimaryContact, updateProfile } from "./actions";

export default async function ProfilePage({ params }: PageProps<"/a/[slug]/profile">) {
  const { slug } = await params;
  const { membership, organization: org } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="label" htmlFor="currency">Currency</label>
            <select className="input" id="currency" name="currency" defaultValue={org.currency}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{CURRENCY_LABEL[c]}</option>
              ))}
            </select>
            <p className="hint">Project values on favorite exhibitors and the total on the dashboard are shown in this currency.</p>
          </div>
        </div>
      </SaveForm>

      <SaveForm
        action={updateEmailIntro.bind(null, slug)}
        title="Introduction email"
        description={'Used in the standard email your users get when they press "Write email" on a favorite exhibitor. Empty fields are left out of the email.'}
        submitLabel="Save email text"
        readOnly={!canEdit}
      >
        <div className="min-w-0">
          <label className="label" htmlFor="emailOffer">What we offer</label>
          <textarea
            id="emailOffer"
            name="emailOffer"
            className="input resize-y leading-relaxed"
            rows={3}
            maxLength={MAX_EMAIL_OFFER}
            defaultValue={org.emailOffer ?? ""}
            placeholder="e.g. We supply custom exhibition stands and furniture for trade shows across Europe."
          />
          <p className="hint">A few lines about what your company delivers. Written in English, like the rest of the email.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: EMAIL_BENEFITS }, (_, i) => (
            <Field
              key={i}
              id={`emailBenefit${i + 1}`}
              name="emailBenefit"
              label={`Benefit ${i + 1}`}
              defaultValue={org.emailBenefits[i] ?? ""}
              maxLength={MAX_EMAIL_BENEFIT}
              placeholder={["e.g. Fixed prices, no surprises", "e.g. Ready in 4 weeks", "e.g. One contact from start to finish"][i]}
            />
          ))}
        </div>
        <p className="hint -mt-2">Shown as a bullet list in the email.</p>
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
