// Platform admins maintain the shared directory (exhibition centers and, later,
// trade shows, organizers and exhibitors) that every account sees. They are
// listed by email in the PLATFORM_ADMIN_EMAILS environment variable, separated
// by commas, so no one can become one from inside the app.

export function platformAdminEmails(value = process.env.PLATFORM_ADMIN_EMAILS): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(email: string, value?: string): boolean {
  return platformAdminEmails(value).has(email.trim().toLowerCase());
}
