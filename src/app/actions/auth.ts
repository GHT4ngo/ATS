"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setLocaleCookie } from "@/lib/auth/locale";
import {
  emailSchema,
  loginSchema,
  newPasswordSchema,
  type ActionState,
} from "@/lib/auth/schemas";

export async function login(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "user_banned" ? "accountInactive" : "invalidCredentials",
    };
  }

  const current = await getCurrentUser();
  if (!current || !current.profile.is_active) {
    await supabase.auth.signOut();
    return { error: "accountInactive" };
  }

  await setLocaleCookie(current.profile.locale);
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the address exists, so it cannot be probed.
  return { ok: true };
}

export async function setNewPassword(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      error: field === "confirm" ? "passwordMismatch" : "passwordTooShort",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return {
      error: error.code === "same_password" ? "samePassword" : "generic",
    };
  return { ok: true };
}
