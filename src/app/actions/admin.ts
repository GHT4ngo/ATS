"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTING_ORG_COOKIE, requireAdmin } from "@/lib/auth/session";
import {
  createUserSchema,
  organizationSchema,
  resetPasswordSchema,
  slugify,
  setActingOrganizationSchema,
  setUserActiveSchema,
  type ActionState,
} from "@/lib/auth/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BAN_FOREVER = "876000h";

export async function createOrganization(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };

  const slug = slugify(parsed.data.name);
  if (!slug) return { error: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, slug });
  if (error) return { error: error.code === "23505" ? "slugTaken" : "generic" };

  revalidatePath("/admin/organizations");
  return { ok: true };
}

export async function createUser(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = createUserSchema.safeParse({
    ...raw,
    organizationId: raw.organizationId || undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      error: field === "password" ? "passwordTooShort" : "invalidInput",
    };
  }
  const { email, fullName, role, organizationId, password } = parsed.data;

  // Role and organization go in app_metadata, which only the service role can
  // set. The database trigger turns them into the profile.
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role,
      ...(role === "customer" ? { organization_id: organizationId } : {}),
    },
    user_metadata: { full_name: fullName },
  });
  if (error)
    return { error: error.code === "email_exists" ? "emailTaken" : "generic" };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionState> {
  const { profile } = await requireAdmin();
  const parsed = setUserActiveSchema.safeParse({ userId, active });
  if (!parsed.success) return { error: "invalidInput" };
  if (parsed.data.userId === profile.id)
    return { error: "cannotDeactivateSelf" };

  // The profile flag cuts off RLS access; the ban blocks new logins and token
  // refreshes. If the ban fails, the profile is put back so both stay in step.
  const admin = createAdminClient();
  const setProfile = (value: boolean) =>
    admin
      .from("profiles")
      .update({ is_active: value })
      .eq("id", parsed.data.userId);

  const { error: profileError } = await setProfile(parsed.data.active);
  if (profileError) return { error: "generic" };
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.active ? "none" : BAN_FOREVER,
  });
  if (error) {
    await setProfile(!parsed.data.active);
    return { error: "generic" };
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetUserPassword(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "passwordTooShort" };

  const { error } = await createAdminClient().auth.admin.updateUserById(
    parsed.data.userId,
    {
      password: parsed.data.password,
    },
  );
  if (error) return { error: "generic" };
  return { ok: true };
}

/** Admin "act as customer": the whole app scopes to this organization until cleared. */
export async function setActingOrganization(
  organizationId: string,
): Promise<void> {
  await requireAdmin();
  const parsed = setActingOrganizationSchema.safeParse({ organizationId });
  if (!parsed.success) return;
  const store = await cookies();
  if (!parsed.data.organizationId) {
    store.delete(ACTING_ORG_COOKIE);
  } else {
    const { data } = await (
      await createClient()
    )
      .from("organizations")
      .select("id")
      .eq("id", parsed.data.organizationId)
      .maybeSingle();
    if (!data) return;
    store.set(ACTING_ORG_COOKIE, data.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  revalidatePath("/", "layout");
}
