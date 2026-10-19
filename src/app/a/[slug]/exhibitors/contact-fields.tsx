"use client";

import { useRef, useState, useTransition } from "react";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import type { ContactFields as ContactValues, FoundContact } from "@/lib/contact-finder";
import type { ContactState } from "./actions";

const LABELS: Record<keyof FoundContact, string> = { contactName: "contact person", contactTitle: "position", email: "email", phone: "phone" };

/**
 * The contact person, position, email and phone inputs, with a button that
 * lets AI look them up on the website typed in the same form. Only empty
 * inputs are filled, and nothing is saved until the form is.
 */
export function ContactFields({
  values,
  find,
}: {
  values: { [K in keyof FoundContact]: string };
  /** Leave out when no AI key is set; the button is then hidden. */
  find?: (name: string, website: string, typed: ContactValues) => Promise<ContactState>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  function onFind() {
    const form = box.current?.closest("form");
    if (!form || !find) return;
    const value = (field: string) => String(new FormData(form).get(field) ?? "");
    setMessage(undefined);
    startTransition(async () => {
      const typed = { contactName: value("contactName"), contactTitle: value("contactTitle"), email: value("email"), phone: value("phone") };
      const result = await find(value("name"), value("website"), typed);
      if (!result.contact) return setMessage({ ok: false, text: result.error ?? "No contact was found." });
      const input = (field: string) => form.elements.namedItem(field) as HTMLInputElement | null;
      // The position belongs to the person, so it is only filled together with the name.
      const nameEmpty = !input("contactName")?.value.trim();
      const filled: string[] = [];
      for (const field of Object.keys(LABELS) as (keyof FoundContact)[]) {
        const found = result.contact[field];
        const el = input(field);
        if (!found || !el || (el.value.trim() && !result.replace?.includes(field))) continue;
        if (field === "contactTitle" && !(nameEmpty && result.contact.contactName)) continue;
        el.value = found;
        filled.push(LABELS[field]);
      }
      const note = result.hunterNote ? ` ${result.hunterNote}` : "";
      setMessage(
        filled.length > 0
          ? { ok: true, text: `AI filled in ${filled.length > 1 ? `${filled.slice(0, -1).join(", ")} and ${filled.at(-1)}` : filled[0]} ${result.viaHunter ? "from the website and Hunter.io" : "from the website"}. ${result.saved ? "It is saved." : "Check it before you save."}${note}` }
          : { ok: false, text: `AI found nothing new: the fields it found on the website are already filled in.${note}` },
      );
    });
  }

  return (
    <div ref={box} className="flex flex-col gap-4">
      {find && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="hint mt-0">AI can look up the contact person on the company&apos;s website. Only empty fields are filled.</p>
          <button type="button" className="btn-secondary" onClick={onFind} disabled={pending}>
            <Icon name="sparkle" className="size-4 text-brand" />
            {pending ? "Looking… (up to a minute)" : "Find contact with AI"}
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contactName" label="Contact person" defaultValue={values.contactName} maxLength={100} placeholder="John Smith" readOnly={pending} />
        <Field id="contactTitle" label="Contact position" defaultValue={values.contactTitle} maxLength={100} placeholder="Sales Manager" readOnly={pending} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Email" type="email" defaultValue={values.email} placeholder="contact@company.com" readOnly={pending} />
        <Field id="phone" label="Phone" type="tel" defaultValue={values.phone} maxLength={30} placeholder="+45 12 34 56 78" readOnly={pending} />
      </div>
      {message && <p className={message.ok ? "success" : "error"} role="status">{message.text}</p>}
    </div>
  );
}
