import type { ExhibitionOrganizer } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";

/** The inputs shared by the add and edit forms. */
export function OrganizerFields({ organizer }: { organizer?: ExhibitionOrganizer }) {
  return (
    <>
      <Field id="name" label="Organizer company" defaultValue={organizer?.name} required maxLength={150} placeholder="Messe Düsseldorf GmbH" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="website" label="Website" defaultValue={organizer?.website ?? ""} placeholder="messe-duesseldorf.de" maxLength={300} />
        <CountrySelect id="country" defaultValue={organizer?.country} />
      </div>
    </>
  );
}
