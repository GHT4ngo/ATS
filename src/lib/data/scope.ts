import "server-only";
import { redirect } from "next/navigation";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

/**
 * The only way app code reaches organization data. RLS gives admins every
 * organization, so each query and insert here is pinned to the active one;
 * that is what makes "act as customer" safe. Redirects to the dashboard when
 * an admin has not picked an organization yet.
 */
export async function getScope() {
  const scope = await getOptionalScope();
  if (!scope) redirect("/dashboard");
  return scope;
}

/** Like getScope, but null instead of a redirect when no organization is active. */
export async function getOptionalScope() {
  const { user, profile } = await requireUser();
  const org = await getActiveOrganization();
  if (!org) return null;

  const supabase = await createClient();
  const orgId = org.id;

  return {
    supabase,
    orgId,
    userId: user.id,
    profile,
    jobs: () => supabase.from("jobs").select("*").eq("organization_id", orgId),
    candidates: () =>
      supabase.from("candidates").select("*").eq("organization_id", orgId),
    applications: () =>
      supabase.from("applications").select("*").eq("organization_id", orgId),
    /** The newest assessment per candidate and job. */
    latestAssessments: () =>
      supabase
        .from("latest_cv_assessments")
        .select("*")
        .eq("organization_id", orgId),
    insertJob: (row: Omit<Tables["jobs"]["Insert"], "organization_id">) =>
      supabase.from("jobs").insert({ ...row, organization_id: orgId }),
    insertCandidate: (
      row: Omit<Tables["candidates"]["Insert"], "organization_id">,
    ) => supabase.from("candidates").insert({ ...row, organization_id: orgId }),
    insertApplications: (
      rows: Omit<Tables["applications"]["Insert"], "organization_id">[],
    ) =>
      supabase
        .from("applications")
        .insert(rows.map((row) => ({ ...row, organization_id: orgId }))),
    deleteCandidate: (id: string) =>
      supabase
        .from("candidates")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId),
    deleteApplications: (candidateId: string, jobIds: string[]) =>
      supabase
        .from("applications")
        .delete()
        .eq("organization_id", orgId)
        .eq("candidate_id", candidateId)
        .in("job_id", jobIds),
    updateJob: (id: string, patch: Tables["jobs"]["Update"]) =>
      supabase
        .from("jobs")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId),
    updateCandidate: (id: string, patch: Tables["candidates"]["Update"]) =>
      supabase
        .from("candidates")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId),
    updateApplication: (id: string, patch: Tables["applications"]["Update"]) =>
      supabase
        .from("applications")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", orgId),
    log: (
      entity: "job" | "candidate" | "application",
      entityId: string,
      action: string,
      payload: Record<string, string | number | null> = {},
    ) =>
      supabase.from("activity_log").insert({
        organization_id: orgId,
        actor_id: user.id,
        entity,
        entity_id: entityId,
        action,
        payload,
      }),
  };
}
