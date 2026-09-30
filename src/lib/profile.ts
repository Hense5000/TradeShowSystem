import type { Contact, Organization } from "@prisma/client";

type ProfileFields = Pick<Organization, "addressLine1" | "postalCode" | "city" | "country">;

/**
 * An account's profile counts as complete when it has an address we can put
 * on an invoice and a primary contact. Used for the reminder dot in the menu.
 */
export function isProfileComplete(organization: ProfileFields, primaryContact: Pick<Contact, "name" | "email"> | null): boolean {
  const hasAddress = Boolean(organization.addressLine1 && organization.postalCode && organization.city && organization.country);
  return hasAddress && Boolean(primaryContact?.name && primaryContact.email);
}
