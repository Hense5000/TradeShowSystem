import type { ExhibitionCenter } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";

/** The inputs shared by the add and edit forms. */
export function CenterFields({ center }: { center?: ExhibitionCenter }) {
  return (
    <>
      <Field id="name" label="Exhibition center name" defaultValue={center?.name} required maxLength={150} placeholder="Messe Berlin" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="city" label="City" defaultValue={center?.city ?? ""} maxLength={100} />
        <CountrySelect id="country" defaultValue={center?.country} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="website" label="Website" defaultValue={center?.website ?? ""} placeholder="messe-berlin.de" maxLength={300} />
        <Field
          id="eventsUrl"
          label="Local events URL"
          defaultValue={center?.eventsUrl ?? ""}
          placeholder="messe-berlin.de/events"
          hint="The center's own page listing upcoming events."
          maxLength={300}
        />
      </div>
    </>
  );
}
