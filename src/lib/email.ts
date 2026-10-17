import "server-only";

// Emails are sent through Resend (https://resend.com). It needs RESEND_API_KEY
// and EMAIL_FROM, a sender on a domain verified in Resend, for example
// "Trade Show System <noreply@ngasoft.dk>". Without them no email is sent.

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, text }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
}
