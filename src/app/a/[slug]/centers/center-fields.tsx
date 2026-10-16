import type { ExhibitionCenter } from "@prisma/client";
import { CountrySelect, Field } from "@/components/field";
import type { EventsPageState } from "./actions";
import { EventsUrlFields } from "./events-url-fields";

/** The inputs shared by the add and edit forms. */
export function CenterFields({
  center,
  findEventsPage,
}: {
  center?: ExhibitionCenter;
  /** Looks up the events page with AI; left out when no AI key is set. */
  findEventsPage?: (center: { name: string; city: string; country: string; website: string }) => Promise<EventsPageState>;
}) {
  return (
    <>
      <Field id="name" label="Exhibition center name" defaultValue={center?.name} required maxLength={150} placeholder="Messe Berlin" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="city" label="City" defaultValue={center?.city ?? ""} maxLength={100} />
        <CountrySelect id="country" defaultValue={center?.country} />
      </div>
      <EventsUrlFields website={center?.website ?? ""} eventsUrl={center?.eventsUrl ?? ""} find={findEventsPage} />
    </>
  );
}
