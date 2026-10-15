import type { Exhibitor } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";
import type { ContactState, ProfileState } from "./actions";
import { ContactFields } from "./contact-fields";
import { CompanyProfileField } from "./profile-field";
import { type ShowOption, ShowSelect } from "./show-select";

/** The inputs shared by the add and edit forms. */
export function ExhibitorFields({
  exhibitor,
  shows,
  showId,
  generateProfile,
  findContact,
}: {
  exhibitor?: Exhibitor;
  shows: ShowOption[];
  showId?: string;
  /** Writes the company profile with AI; left out when no AI key is set. */
  generateProfile?: (name: string, website: string) => Promise<ProfileState>;
  /** Looks up the contact person with AI; left out when no AI key is set. */
  findContact?: (name: string, website: string) => Promise<ContactState>;
}) {
  const e = exhibitor;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Company name" defaultValue={e?.name} required maxLength={150} placeholder="Acme Corporation" />
        <ShowSelect shows={shows} defaultValue={e?.tradeShowId ?? showId} />
      </div>
      <ContactFields
        find={findContact}
        values={{ contactName: e?.contactName ?? "", contactTitle: e?.contactTitle ?? "", email: e?.email ?? "", phone: e?.phone ?? "" }}
      />
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
