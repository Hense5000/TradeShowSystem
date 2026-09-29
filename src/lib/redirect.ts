/** Only allow redirects to paths on this site, never to another domain. */
export function safeCallbackUrl(value: unknown, fallback = "/accounts"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
