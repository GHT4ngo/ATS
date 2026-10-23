import { z } from "zod";

export const PASSWORD_MIN = 10;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const emailSchema = z.object({ email: z.email() });

export const newPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  locale: z.enum(["sv", "en"]),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const createUserSchema = z
  .object({
    email: z.email().max(320),
    fullName: z.string().trim().min(1).max(200),
    role: z.enum(["admin", "customer"]),
    organizationId: z.uuid().optional(),
    password: z.string().min(PASSWORD_MIN).max(200),
  })
  .refine((v) => v.role === "admin" || v.organizationId, {
    path: ["organizationId"],
    message: "required",
  });

export const setUserActiveSchema = z.object({
  userId: z.uuid(),
  active: z.boolean(),
});

export const setActingOrganizationSchema = z.object({
  organizationId: z.union([z.uuid(), z.literal("")]),
});

export const resetPasswordSchema = z.object({
  userId: z.uuid(),
  password: z.string().min(PASSWORD_MIN).max(200),
});

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ActionState = { error?: string; ok?: boolean };
