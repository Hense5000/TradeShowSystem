// The email to the platform owner when a new customer signs up and creates a
// company account. signup-notify-run.ts sends it.

/** Who is told about new sign-ups: SIGNUP_NOTIFY_EMAIL, or Henrik's address. */
export function signupNotifyEmail(value = process.env.SIGNUP_NOTIFY_EMAIL): string {
  return (value ?? "").trim() || "hn@vivolead.com";
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The email about a new customer account: name, company and email of the person who signed up. */
export function signupNotifyEmailContent({ name, email, companyName }: { name: string; email: string; companyName: string }) {
  const rows: [string, string][] = [
    ["Name", name],
    ["Company", companyName],
    ["Email", email],
  ];
  return {
    subject: `New customer: ${companyName}`,
    text: `A new customer has created an account in Trade Show System.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>A new customer has created an account in Trade Show System.</p>` +
      `<table style="border-collapse:collapse">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 16px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0;font-weight:bold">${
              k === "Email" ? `<a href="mailto:${escape(v)}" style="color:#287bbf">${escape(v)}</a>` : escape(v)
            }</td></tr>`,
        )
        .join("") +
      `</table></div>`,
  };
}
