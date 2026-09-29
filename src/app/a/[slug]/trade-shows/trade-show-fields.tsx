import type { TradeShow } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";
import { isoDate } from "@/lib/dates";

/** The inputs shared by the add and edit forms. */
export function TradeShowFields({ show }: { show?: TradeShow }) {
  return (
    <>
      <Field id="name" label="Trade show name" defaultValue={show?.name} required maxLength={150} placeholder="InnoTrans" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startDate" label="Start date" type="date" defaultValue={show ? isoDate(show.startDate) : ""} required />
        <Field id="endDate" label="End date" type="date" defaultValue={show ? isoDate(show.endDate) : ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="city" label="City" defaultValue={show?.city ?? ""} maxLength={100} />
        <CountrySelect id="country" defaultValue={show?.country} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="website" label="Website" defaultValue={show?.website ?? ""} placeholder="innotrans.de" maxLength={300} />
        <Field
          id="exhibitorDirectoryUrl"
          label="Exhibitor directory URL"
          defaultValue={show?.exhibitorDirectoryUrl ?? ""}
          placeholder="innotrans.de/exhibitors"
          hint="The show's own list of exhibitors."
          maxLength={300}
        />
      </div>
      <p className="hint -mt-1">The status (upcoming, running or finished) follows from the dates.</p>
    </>
  );
}
