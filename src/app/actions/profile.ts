"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { profileSchema, type ActionState } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { setLocaleCookie } from "@/lib/auth/locale";

export async function updateProfile(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, locale: parsed.data.locale })
    .eq("id", profile.id);
  if (error) return { error: "generic" };

  await setLocaleCookie(parsed.data.locale);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setLanguage(locale: string): Promise<void> {
  const { profile } = await requireUser();
  const parsed = profileSchema.shape.locale.safeParse(locale);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ locale: parsed.data })
    .eq("id", profile.id);
  await setLocaleCookie(parsed.data);
  revalidatePath("/", "layout");
}
