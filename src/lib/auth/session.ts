import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ACTING_ORG_COOKIE = "acting_org";

/** The signed in user and their profile, or null when signed out. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { user, profile };
});

/** Redirects to the login page unless there is an active user. */
export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (!current.profile.is_active) redirect("/auth/inactive");
  return current;
}

export async function requireAdmin() {
  const current = await requireUser();
  if (current.profile.role !== "admin") redirect("/dashboard");
  return current;
}

/**
 * The organization the app is currently scoped to: a customer's own, or for an
 * admin the one picked in the switcher (null until they pick one).
 */
export const getActiveOrganization = cache(async () => {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let orgId = profile.organization_id;
  if (profile.role === "admin") {
    orgId = (await cookies()).get(ACTING_ORG_COOKIE)?.value ?? null;
  }
  if (!orgId) return null;

  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .maybeSingle();
  return data;
});
