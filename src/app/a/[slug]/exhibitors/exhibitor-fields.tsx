import type { Exhibitor } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";
import type { ProfileState } from "./actions";
import { CompanyProfileField } from "./profile-field";
import { type ShowOption, ShowSelect } from "./show-select";

/** The inputs shared by the add and edit forms. */
export function ExhibitorFields({
  exhibitor,
  shows,
  showId,
  generateProfile,
}: {
  exhibitor?: Exhibitor;
  shows: ShowOption[];
  showId?: string;
  /** Writes the company profile with AI; left out when no AI key is set. */
  generateProfile?: (name: string, website: string) => Promise<ProfileState>;
}) {
  const e = exhibitor;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Company name" defaultValue={e?.name} required maxLength={150} placeholder="Acme Corporation" />
        <ShowSelect shows={shows} defaultValue={e?.tradeShowId ?? showId} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contactName" label="Contact person" defaultValue={e?.contactName ?? ""} maxLength={100} placeholder="John Smith" />
        <Field id="contactTitle" label="Contact position" defaultValue={e?.contactTitle ?? ""} maxLength={100} placeholder="Sales Manager" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Email" type="email" defaultValue={e?.email ?? ""} placeholder="contact@company.com" />
        <Field id="phone" label="Phone" type="tel" defaultValue={e?.phone ?? ""} maxLength={30} placeholder="+45 12 34 56 78" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="website" label="Website" defaultValue={e?.website ?? ""} maxLength={300} placeholder="company.com" />
        <CountrySelect id="country" defaultValue={e?.country} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="industry" label="Industry" defaultValue={e?.industry ?? ""} maxLength={100} placeholder="Technology" />
        <Field id="boothNumber" label="Booth no." defaultValue={e?.boothNumber ?? ""} maxLength={50} placeholder="A-123" />
      </div>
      <Field id="standLocationUrl" label="Stand location URL" defaultValue={e?.standLocationUrl ?? ""} maxLength={300} placeholder="floorplan.com/booth/123" hint="Link to the booth on the show's floor plan." />
      <CompanyProfileField defaultValue={e?.companyProfile ?? ""} generate={generateProfile} />
    </>
  );
}
