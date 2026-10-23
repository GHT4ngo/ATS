"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/auth/schemas";
import { candidateSchema, noteSchema } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";

const MAX_CV_BYTES = 4 * 1024 * 1024;

function parse(formData: FormData) {
  const fields = Object.fromEntries(
    [...formData.entries()].filter(([k]) => k !== "jobIds" && k !== "cv"),
  );
  return candidateSchema.safeParse({
    ...fields,
    jobIds: formData.getAll("jobIds").map(String),
  });
}

function getCv(formData: FormData) {
  const cv = formData.get("cv");
  return cv instanceof File && cv.size > 0 ? cv : null;
}

function cvProblem(cv: File | null) {
  if (!cv) return null;
  if (cv.size > MAX_CV_BYTES) return "cvTooLarge";
  if (cv.type !== "application/pdf") return "cvNotPdf";
  return null;
}

async function uploadCv(
  scope: Awaited<ReturnType<typeof getScope>>,
  candidateId: string,
  cv: File,
) {
  const path = `${scope.orgId}/${candidateId}/cv.pdf`;
  const { error } = await scope.supabase.storage
    .from("cvs")
    .upload(path, cv, { contentType: "application/pdf", upsert: true });
  if (error) return false;
  const { error: updateError } = await scope.updateCandidate(candidateId, {
    cv_path: path,
  });
  return !updateError;
}

function applicationRows(candidateId: string, jobIds: string[]) {
  return jobIds.map((jobId) => ({
    candidate_id: candidateId,
    job_id: jobId,
    position: Date.now(),
  }));
}

export async function createCandidate(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = parse(formData);
  if (!parsed.success) return { error: "invalidInput" };
  const cv = getCv(formData);
  const problem = cvProblem(cv);
  if (problem) return { error: problem };

  const { jobIds, fullName, linkedinUrl, ...rest } = parsed.data;
  const id = randomUUID();
  const { error } = await scope.insertCandidate({
    id,
    full_name: fullName,
    linkedin_url: linkedinUrl,
    ...rest,
  });
  if (error)
    return { error: error.code === "23505" ? "duplicateEmail" : "generic" };

  if (jobIds.length) {
    const { error: appError } = await scope.supabase
      .from("applications")
      .insert(
        applicationRows(id, jobIds).map((r) => ({
          ...r,
          organization_id: scope.orgId,
        })),
      );
    if (appError) return { error: "generic" };
  }
  await scope.log("candidate", id, "created", { name: fullName });
  if (cv && !(await uploadCv(scope, id, cv)))
    return { error: "cvUploadFailed" };

  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function updateCandidate(
  candidateId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const scope = await getScope();
  const idCheck = z.uuid().safeParse(candidateId);
  const parsed = parse(formData);
  if (!idCheck.success || !parsed.success) return { error: "invalidInput" };
  const id = idCheck.data;
  const cv = getCv(formData);
  const problem = cvProblem(cv);
  if (problem) return { error: problem };

  const { jobIds, fullName, linkedinUrl, ...rest } = parsed.data;
  const { error } = await scope.updateCandidate(id, {
    full_name: fullName,
    linkedin_url: linkedinUrl,
    ...rest,
  });
  if (error)
    return { error: error.code === "23505" ? "duplicateEmail" : "generic" };

  const { data: existing } = await scope.applications().eq("candidate_id", id);
  const current = new Set((existing ?? []).map((a) => a.job_id));
  const wanted = new Set(jobIds);
  const toAdd = jobIds.filter((j) => !current.has(j));
  const toRemove = [...current].filter((j) => !wanted.has(j));

  if (toAdd.length) {
    const { error: addError } = await scope.supabase
      .from("applications")
      .insert(
        applicationRows(id, toAdd).map((r) => ({
          ...r,
          organization_id: scope.orgId,
        })),
      );
    if (addError) return { error: "generic" };
  }
  if (toRemove.length) {
    await scope.supabase
      .from("applications")
      .delete()
      .eq("organization_id", scope.orgId)
      .eq("candidate_id", id)
      .in("job_id", toRemove);
  }
  await scope.log("candidate", id, "updated", { name: fullName });
  if (cv && !(await uploadCv(scope, id, cv)))
    return { error: "cvUploadFailed" };

  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function saveNotes(
  candidateId: string,
  notes: string,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = noteSchema.safeParse({ candidateId, notes });
  if (!parsed.success) return { error: "invalidInput" };
  const { error } = await scope.updateCandidate(parsed.data.candidateId, {
    notes: parsed.data.notes,
  });
  if (error) return { error: "generic" };
  await scope.log("candidate", parsed.data.candidateId, "notes");
  revalidatePath("/candidates");
  return { ok: true };
}

/** A short lived link to the candidate's CV, or null when there is none. */
export async function getCvUrl(candidateId: string) {
  const scope = await getScope();
  const id = z.uuid().safeParse(candidateId);
  if (!id.success) return null;
  const { data: candidate } = await scope
    .candidates()
    .eq("id", id.data)
    .maybeSingle();
  if (!candidate?.cv_path) return null;
  const { data } = await scope.supabase.storage
    .from("cvs")
    .createSignedUrl(candidate.cv_path, 60);
  return data?.signedUrl ?? null;
}
