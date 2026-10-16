"use client";

import { useRef, useState, useTransition } from "react";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import type { EventsPageState } from "./actions";

type Center = { name: string; city: string; country: string; website: string };

/**
 * The website and Local events URL inputs, with a button that lets AI find
 * the center's events page. Only empty inputs are filled, and nothing is
 * saved until the form is.
 */
export function EventsUrlFields({
  website,
  eventsUrl,
  find,
}: {
  website: string;
  eventsUrl: string;
  /** Leave out when no AI key is set; the button is then hidden. */
  find?: (center: Center) => Promise<EventsPageState>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  function onFind() {
    const form = box.current?.closest("form");
    if (!form || !find) return;
    const data = new FormData(form);
    const value = (field: string) => String(data.get(field) ?? "");
    const input = (field: string) => form.elements.namedItem(field) as HTMLInputElement | null;
    if (input("eventsUrl")?.value.trim()) {
      return setMessage({ ok: false, text: "The Local events URL is already filled in. Empty it first if AI should look for another one." });
    }
    setMessage(undefined);
    startTransition(async () => {
      const result = await find({ name: value("name"), city: value("city"), country: value("country"), website: value("website") });
      if (!result.eventsUrl) return setMessage({ ok: false, text: result.error ?? "No events page was found." });
      const events = input("eventsUrl");
      if (events && !events.value.trim()) events.value = result.eventsUrl;
      const site = input("website");
      const addedSite = Boolean(result.website && site && !site.value.trim());
      if (addedSite && site) site.value = result.website!;
      setMessage({
        ok: true,
        text: `AI filled in the Local events URL${addedSite ? " and the website" : ""}. Open the link to check it before you save.`,
      });
    });
  }

  return (
    <div ref={box} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="website" label="Website" defaultValue={website} placeholder="messe-berlin.de" maxLength={300} readOnly={pending} />
        <Field
          id="eventsUrl"
          label="Local events URL"
          defaultValue={eventsUrl}
          placeholder="messe-berlin.de/events"
          hint="The center's own page listing upcoming events."
          maxLength={300}
          readOnly={pending}
        />
      </div>
      {find && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="hint mt-0">AI can find the events page on the center&apos;s website. Only empty fields are filled.</p>
          <button type="button" className="btn-secondary" onClick={onFind} disabled={pending}>
            <Icon name="sparkle" className="size-4 text-brand" />
            {pending ? "Looking… (up to a minute)" : "Find events page with AI"}
          </button>
        </div>
      )}
      {message && <p className={message.ok ? "success" : "error"} role="status">{message.text}</p>}
    </div>
  );
}
