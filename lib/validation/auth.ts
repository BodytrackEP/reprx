import { z } from "zod";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const totpSchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "The passwords don't match.",
  });

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const emailLinkSchema = z.object({
  tokenHash: z.string().min(1),
  type: z.enum(["invite", "recovery"]),
});

export const inviteSchema = z.object({
  email: z.email("Enter a valid email address."),
  displayName: z.string().trim().min(1, "Enter a name.").max(100),
  role: z.enum(["ep", "admin"]),
  mode: z.enum(["email", "link"]).default("email"),
});

export const staffUpdateSchema = z.object({
  id: z.uuid(),
  role: z.enum(["ep", "admin"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
