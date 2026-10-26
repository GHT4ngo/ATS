import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ErasureReason = "request" | "removed" | "retention";

/** Days a removed candidate or job is kept before it is erased for good. */
export const REMOVED_DAYS = 30;
/** Months without activity before a candidate is erased. */
export const RETENTION_MONTHS = 24;

/**
 * Erases a candidate for good: the CV file first, then in one transaction the
 * row, the applications, the CV assessments and the log entries about them,
 * and records the erasure without personal data. If the file cannot be
 * deleted nothing else is, so the erase can be tried again. Service role: the
 * caller checks who may do this. False when nothing was erased.
 */
export async function eraseCandidateData(
  orgId: string,
  candidateId: string,
  actor: string | null,
  reason: ErasureReason,
): Promise<boolean> {
  const admin = createAdminClient();
  const folder = `${orgId}/${candidateId}`;
  const { data: files, error: listError } = await admin.storage
    .from("cvs")
    .list(folder);
  const { error: removeError } = files?.length
    ? await admin.storage
        .from("cvs")
        .remove(files.map((f) => `${folder}/${f.name}`))
    : { error: null };
  if (listError || removeError) {
    console.error("CV file not erased", folder, listError ?? removeError);
    return false;
  }

  const { data, error } = await admin.rpc("erase_candidate", {
    p_id: candidateId,
    // null for the daily retention job, which acts as nobody.
    p_actor: actor as string,
    p_reason: reason,
  });
  if (error) console.error("Candidate not erased", candidateId, error);
  return !error && Boolean(data);
}

/** Deletes a job for good, with its stages and applications. Service role. */
export async function purgeJobData(
  jobId: string,
  actor: string | null,
  reason: ErasureReason,
) {
  const { data, error } = await createAdminClient().rpc("purge_job", {
    p_id: jobId,
    // null for the daily retention job, which acts as nobody.
    p_actor: actor as string,
    p_reason: reason,
  });
  return !error && Boolean(data);
}
