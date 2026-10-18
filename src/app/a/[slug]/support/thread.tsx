import type { SupportStatus } from "@prisma/client";
import { ActionForm, type ActionState } from "@/components/action-form";
import { MAX_SUPPORT_MESSAGE } from "@/lib/support";

type Message = { id: string; body: string; fromSupport: boolean; createdAt: Date; author: { id: string; name: string | null; email: string } | null };

const when = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

export const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });

/** Open, closed, or open and waiting for an answer, as seen by support or by the customer. */
export function TicketStatus({ status, waitingOnSupport, forSupport }: { status: SupportStatus; waitingOnSupport: boolean; forSupport: boolean }) {
  if (status === "CLOSED") return <span className="pill pill-neutral">Closed</span>;
  if (forSupport) return waitingOnSupport ? <span className="pill pill-warn">Needs answer</span> : <span className="pill pill-soft">Answered</span>;
  return waitingOnSupport ? <span className="pill pill-soft">Open</span> : <span className="pill pill-ok">Answered</span>;
}

/** A ticket's messages, oldest first, and the form for the next one. */
export function Thread({
  messages,
  viewerId,
  forSupport,
  reply,
}: {
  messages: Message[];
  viewerId: string;
  forSupport: boolean;
  reply: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  return (
    <section className="card flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {messages.map((m) => {
          // Your own side of the conversation is on the right, the other side on the left.
          const mine = m.fromSupport === forSupport;
          const who = m.fromSupport
            ? forSupport && m.author
              ? `${m.author.id === viewerId ? "You" : (m.author.name ?? m.author.email)} (support)`
              : "Trade Show System support"
            : m.author
              ? m.author.id === viewerId
                ? "You"
                : (m.author.name ?? m.author.email)
              : "Former user";
          return (
            <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              <p className="text-xs text-muted">
                <span className="font-semibold text-ink">{who}</span> · {when(m.createdAt)}
              </p>
              <div
                className={`max-w-[46rem] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  mine ? "bg-brand-soft" : "border border-line bg-subtle"
                }`}
              >
                {m.body}
              </div>
            </li>
          );
        })}
      </ol>
      <ActionForm action={reply} className="flex flex-col gap-2 border-t border-line pt-4">
        <label htmlFor="body" className="label">
          {forSupport ? "Answer the customer" : "Write a reply"}
        </label>
        <textarea id="body" name="body" required rows={4} maxLength={MAX_SUPPORT_MESSAGE} className="input resize-y leading-relaxed" />
        <div className="flex items-center justify-between gap-3">
          <p className="hint mt-0">
            {forSupport ? "The customer gets an email with your answer." : "Support gets an email and answers here. You get an email when they do."}
          </p>
          <button className="btn">Send</button>
        </div>
      </ActionForm>
    </section>
  );
}
