import { z } from "zod";
import { isCountryCode } from "@/lib/countries";
import { parseDate } from "@/lib/dates";

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const password = z.string().min(8, "Password must be at least 8 characters.").max(200);

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email,
  password,
  companyName: z.string().trim().max(100).optional(),
  invite: z.string().optional(),
});

export const accountSchema = z.object({
  companyName: z.string().trim().min(1, "Enter a company name.").max(100),
});

export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const inviteSchema = z.object({ email, role: roleSchema });

/** Optional text field: trimmed, and an empty field becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((v) => v || null);

/** Accepts "example.com" as well as "https://example.com"; stores a full https URL. */
const webAddress = (label: string) =>
  z
    .string()
    .trim()
    .max(300, `${label} can be at most 300 characters.`)
    .transform((v, ctx) => {
      if (!v) return null;
      const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      try {
        const url = new URL(withScheme);
        if (!url.hostname.includes(".") || /\s/.test(v)) throw new Error();
        return url.toString().replace(/\/$/, "");
      } catch {
        ctx.addIssue({ code: "custom", message: `${label}: enter a valid web address, for example example.com.` });
        return z.NEVER;
      }
    });

export const website = webAddress("Website");

const country = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === "" || isCountryCode(v), "Pick a country from the list.")
  .transform((v) => v || null);

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter a company name.").max(100),
  vatNumber: optionalText(30, "VAT number"),
  addressLine1: optionalText(100, "Address"),
  addressLine2: optionalText(100, "Address line 2"),
  postalCode: optionalText(20, "Postal code"),
  city: optionalText(100, "City"),
  region: optionalText(100, "Region"),
  country,
  website,
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter the contact's name.").max(100),
  email,
  phone: z
    .string()
    .trim()
    .max(30, "Phone can be at most 30 characters.")
    .refine((v) => v === "" || /^\+?[\d\s().-]{5,}$/.test(v), "Enter a valid phone number, for example +45 12 34 56 78.")
    .transform((v) => v || null),
});

export const centerSchema = z.object({
  name: z.string().trim().min(1, "Enter the exhibition center's name.").max(150, "Name can be at most 150 characters."),
  city: optionalText(100, "City"),
  country,
  website,
  eventsUrl: webAddress("Local events URL"),
});

export type CenterInput = z.infer<typeof centerSchema>;

export const organizerSchema = z.object({
  name: z.string().trim().min(1, "Enter the organizer's company name.").max(150, "Name can be at most 150 characters."),
  website,
  country,
});

export type OrganizerInput = z.infer<typeof organizerSchema>;

const requiredDate = (label: string) =>
  z.string().transform((v, ctx) => {
    if (!v.trim()) {
      ctx.addIssue({ code: "custom", message: `Enter the ${label.toLowerCase()}.` });
      return z.NEVER;
    }
    const date = parseDate(v);
    if (!date) {
      ctx.addIssue({ code: "custom", message: `${label}: "${v.trim()}" is not a date. Use a date like 2026-09-22.` });
      return z.NEVER;
    }
    return date;
  });

export const tradeShowSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the trade show's name.").max(150, "Name can be at most 150 characters."),
    startDate: requiredDate("Start date"),
    endDate: requiredDate("End date"),
    city: optionalText(100, "City"),
    country,
    website,
    exhibitorDirectoryUrl: webAddress("Exhibitor directory URL"),
  })
  .refine((s) => s.endDate >= s.startDate, { message: "The end date can't be before the start date.", path: ["endDate"] });

export type TradeShowInput = z.infer<typeof tradeShowSchema>;

/** First error message from a failed parse, for showing in a form. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
