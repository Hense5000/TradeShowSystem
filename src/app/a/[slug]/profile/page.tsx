import { ActionForm } from "@/components/action-form";
import { CountrySelect, Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { hunterStatus } from "@/lib/own-contacts-run";
import { EMAIL_BENEFITS, MAX_EMAIL_BENEFIT, MAX_EMAIL_OFFER } from "@/lib/email-draft";
import { canManageMembers } from "@/lib/permissions";
import { CURRENCIES, CURRENCY_LABEL } from "@/lib/project-value";
import { requireMembership } from "@/lib/tenant";
import { connectHunter, disconnectHunter, updateEmailIntro, updatePrimaryContact, updateProfile } from "./actions";

export default async function ProfilePage({ params }: PageProps<"/a/[slug]/profile">) {
  const { slug } = await params;
  const { membership, organization: org } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const canEdit = canManageMembers(membership.role);
  const [contact, hunter] = await Promise.all([db.contact.findFirst({ where: { organizationId: org.id, isPrimary: true } }), hunterStatus(org.id)]);

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

      {hunter.connected ? (
        <section className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Hunter.io</h2>
              <p className="mt-0.5 text-sm text-muted">
                Your users can press &quot;Find contact with Hunter.io&quot; on a company or a favorite exhibitor. It uses your own Hunter.io credits, and only your account sees the contacts found.
              </p>
            </div>
            {hunter.broken ? <span className="pill pill-neutral">Not working</span> : <span className="pill pill-ok">Connected ✓</span>}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <p>
              <span className="block text-xs text-muted">API key</span>
              <span className="font-medium tabular-nums">{hunter.keyHint}</span>
            </p>
            {hunter.account?.email && (
              <p>
                <span className="block text-xs text-muted">Hunter.io account</span>
                <span className="font-medium">{hunter.account.email}{hunter.account.plan && ` · ${hunter.account.plan}`}</span>
              </p>
            )}
            {hunter.account?.available != null && (
              <p>
                <span className="block text-xs text-muted">Credits left this month</span>
                <span className="font-medium tabular-nums">
                  {Math.max(0, hunter.account.available - (hunter.account.used ?? 0))} of {hunter.account.available}
                  {hunter.account.resetDate && <span className="text-muted"> · renews {formatDateRange(new Date(hunter.account.resetDate), new Date(hunter.account.resetDate))}</span>}
                </span>
              </p>
            )}
            <p>
              <span className="block text-xs text-muted">Connected</span>
              <span className="font-medium">{formatDateRange(hunter.connectedAt, hunter.connectedAt)}{hunter.connectedBy && ` by ${hunter.connectedBy}`}</span>
            </p>
          </div>
          {hunter.broken && <p className="error">Hunter.io no longer accepts this key. Connect your account again with a new key.</p>}
          {canEdit && (
            <ActionForm action={disconnectHunter.bind(null, slug)} confirmMessage="Disconnect Hunter.io? Your users can no longer look up new contacts. The contacts already found stay." className="card-foot mt-1">
              <button className="btn-secondary">Disconnect Hunter.io</button>
            </ActionForm>
          )}
        </section>
      ) : null}
      {(!hunter.connected || hunter.broken) && (
        <SaveForm
          action={connectHunter.bind(null, slug)}
          title={hunter.connected ? "Connect Hunter.io again" : "Connect Hunter.io"}
          description="Hunter.io finds the names and email addresses of people at a company. Connect your own Hunter.io account, and your users can look up contacts for exhibitors with your own Hunter.io credits. The contacts found are only shown to your account."
          submitLabel="Connect Hunter.io"
          readOnly={!canEdit}
        >
          <Field
            id="hunterKey"
            label="Hunter.io API key"
            type="password"
            autoComplete="off"
            maxLength={100}
            placeholder="Paste your API key"
            hint="Log in at hunter.io, open API in the menu and copy your API key. Hunter.io has a free plan with a few searches a month. The key is stored encrypted and never shown again."
          />
        </SaveForm>
      )}

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
