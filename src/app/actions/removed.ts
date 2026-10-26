"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/auth/schemas";
import { getViewMode } from "@/lib/auth/session";
import { getScope } from "@/lib/data/scope";
import { eraseCandidateData, purgeJobData } from "@/lib/data/erase";
import { createAdminClient } from "@/lib/supabase/admin";

function revalidate() {
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

/**
 * Removes a candidate or a job: hidden for everyone in the app, kept for an
 * admin to restore or purge. RLS decides who may remove what.
 */
export async function removeItem(
  entity: "candidate" | "job",
  id: string,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "invalidInput" };
  const { data, error } = await scope.supabase.rpc(
    entity === "candidate" ? "remove_candidate" : "remove_job",
    { p_id: parsed.data },
  );
  if (error || !data) return { error: "generic" };
  await scope.log(entity, parsed.data, "removed");
  revalidate();
  return { ok: true };
}

/** The candidate in the active organization, removed or not, if this caller may erase it. */
async function erasable(
  scope: Awaited<ReturnType<typeof getScope>>,
  id: string,
) {
  // Anyone who can see the candidate may erase it.
  const { data: own } = await scope.candidates().eq("id", id).maybeSingle();
  if (own) return true;
  // Admins may also erase one that has been removed.
  if (!(await getViewMode()).adminUi) return false;
  const { data } = await createAdminClient()
    .from("candidates")
    .select("id")
    .eq("id", id)
    .eq("organization_id", scope.orgId)
    .not("removed_at", "is", null)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Erases a candidate for good, for a GDPR erasure request: the row, the
 * applications, the CV assessments, the log entries and the CV file.
 */
export async function eraseCandidate(id: string): Promise<ActionState> {
  const scope = await getScope();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "invalidInput" };
  if (!(await erasable(scope, parsed.data))) return { error: "generic" };

  const result = await eraseCandidateData(
    scope.orgId,
    parsed.data,
    scope.userId,
    "request",
  );
  if (result === "failed" || result === "gone") return { error: "generic" };
  revalidate();
  if (result === "fileLeft") return { ok: true, error: "cvEraseFailed" };
  return { ok: true };
}

/** Admin only: brings a removed candidate or job back for everyone. */
export async function restoreItem(
  entity: "candidate" | "job",
  id: string,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "invalidInput" };
  if (!(await getViewMode()).adminUi) return { error: "generic" };

  const { data, error } = await createAdminClient()
    .from(entity === "candidate" ? "candidates" : "jobs")
    .update({ removed_at: null, removed_by: null })
    .eq("id", parsed.data)
    .eq("organization_id", scope.orgId)
    .not("removed_at", "is", null)
    .select("id");
  if (error)
    return { error: error.code === "23505" ? "duplicateEmail" : "generic" };
  if (!data?.length) return { error: "generic" };
  await scope.log(entity, parsed.data, "reinstated");
  revalidate();
  return { ok: true };
}

/** Admin only: deletes a removed job for good, with its applications. */
export async function purgeJob(id: string): Promise<ActionState> {
  const scope = await getScope();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { error: "invalidInput" };
  if (!(await getViewMode()).adminUi) return { error: "generic" };

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id")
    .eq("id", parsed.data)
    .eq("organization_id", scope.orgId)
    .not("removed_at", "is", null)
    .maybeSingle();
  if (!job) return { error: "generic" };
  if (!(await purgeJobData(job.id, scope.userId, "request")))
    return { error: "generic" };
  revalidate();
  return { ok: true };
}
