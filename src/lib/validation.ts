import { z } from "zod";

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

/** First error message from a failed parse, for showing in a form. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
