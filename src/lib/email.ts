import "server-only";

// Emails are sent through Resend (https://resend.com). It needs RESEND_API_KEY
// and EMAIL_FROM, a sender on a domain verified in Resend, for example
// "Trade Show System <noreply@ngasoft.dk>". Without them no email is sent.

/**
 * EMAIL_FROM as Resend wants it. Tolerates what easily goes wrong when it is
 * typed into Vercel: surrounding quotes or spaces, and a name without the
 * <> around the address ("Trade Show System noreply@ngasoft.dk").
 */
export function emailSender(value = process.env.EMAIL_FROM ?? ""): string {
  const from = value.trim().replace(/^["']+|["']+$/g, "").trim();
  if (from.includes("<")) return from;
  const match = from.match(/^(.*?)\s*(\S+@\S+)$/);
  if (!match) return from;
  const [, name, address] = match;
  return name ? `${name} <${address}>` : address;
}

function apiKey(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

export function isEmailConfigured(): boolean {
  return Boolean(apiKey() && emailSender());
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailSender(), to, subject, html, text }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
}
