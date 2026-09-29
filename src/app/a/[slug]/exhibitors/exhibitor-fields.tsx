import type { Exhibitor } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";
import { type ShowOption, ShowSelect } from "./show-select";

/** The inputs shared by the add and edit forms. */
export function ExhibitorFields({ exhibitor, shows, showId }: { exhibitor?: Exhibitor; shows: ShowOption[]; showId?: string }) {
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
        <Field id="email" label="Email" type="email" defaultValue={e?.email ?? ""} required placeholder="contact@company.com" />
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
      <div>
        <label className="label" htmlFor="companyProfile">Company profile</label>
        <textarea className="input min-h-28" id="companyProfile" name="companyProfile" defaultValue={e?.companyProfile ?? ""} maxLength={5000} placeholder="A short description of what the company does." />
      </div>
    </>
  );
}
