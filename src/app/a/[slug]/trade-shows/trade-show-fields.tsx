import type { TradeShow } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";
import { SearchSelect } from "@/components/search-select";
import { isoDate } from "@/lib/dates";
import type { TradeShowPickerOptions } from "./picker-options";

/** The inputs shared by the add and edit forms. */
export function TradeShowFields({ show, options }: { show?: TradeShow; options: TradeShowPickerOptions }) {
  return (
    <>
      <Field id="name" label="Trade show name" defaultValue={show?.name} required maxLength={150} placeholder="InnoTrans" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startDate" label="Start date" type="date" defaultValue={show ? isoDate(show.startDate) : ""} required />
        <Field id="endDate" label="End date" type="date" defaultValue={show ? isoDate(show.endDate) : ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SearchSelect
          id="centerId"
          label="Exhibition center"
          options={options.centers}
          defaultValue={show?.centerId}
          searchPlaceholder="Search centers…"
          hint="Missing a center? Add it under Exhibition centers first."
        />
        <SearchSelect
          id="organizerId"
          label="Organizer"
          options={options.organizers}
          defaultValue={show?.organizerId}
          searchPlaceholder="Search organizers…"
          hint="Missing an organizer? Add it under Exhibition organizers first."
        />
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
