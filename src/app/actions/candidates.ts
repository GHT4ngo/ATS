"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/auth/schemas";
import { MAX_CV_BYTES, candidateSchema, noteSchema } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";

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

function revalidate() {
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
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

  const { jobIds, fullName, linkedinUrl, repoUrl, ...rest } = parsed.data;
  const id = randomUUID();
  const { error } = await scope.insertCandidate({
    id,
    full_name: fullName,
    linkedin_url: linkedinUrl,
    repo_url: repoUrl,
    ...rest,
  });
  if (error)
    return { error: error.code === "23505" ? "duplicateEmail" : "generic" };

  if (jobIds.length) {
    const { error: appError } = await scope.insertApplications(
      applicationRows(id, jobIds),
    );
    if (appError) {
      // Undo the candidate so a retry does not create a duplicate.
      await scope.deleteCandidate(id);
      return { error: "generic" };
    }
  }
  await scope.log("candidate", id, "created", { name: fullName });
  revalidate();

  // The candidate is saved either way; a failed upload is reported as a
  // warning so the user can retry it from the profile.
  if (cv && !(await uploadCv(scope, id, cv)))
    return { ok: true, error: "cvUploadFailed" };
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

  const { jobIds, fullName, linkedinUrl, repoUrl, ...rest } = parsed.data;
  const { data: updated, error } = await scope
    .updateCandidate(id, {
      full_name: fullName,
      linkedin_url: linkedinUrl,
      repo_url: repoUrl,
      ...rest,
    })
    .select("id");
  if (error)
    return { error: error.code === "23505" ? "duplicateEmail" : "generic" };
  if (!updated?.length) return { error: "generic" };

  const { data: existing } = await scope.applications().eq("candidate_id", id);
  const current = new Set((existing ?? []).map((a) => a.job_id));
  const wanted = new Set(jobIds);
  const toAdd = jobIds.filter((j) => !current.has(j));
  const toRemove = [...current].filter((j) => !wanted.has(j));

  if (toAdd.length) {
    const { error: addError } = await scope.insertApplications(
      applicationRows(id, toAdd),
    );
    if (addError) return { error: "generic" };
  }
  if (toRemove.length) {
    const { error: removeError } = await scope.deleteApplications(id, toRemove);
    if (removeError) return { error: "generic" };
  }
  await scope.log("candidate", id, "updated", { name: fullName });
  revalidate();

  if (cv && !(await uploadCv(scope, id, cv)))
    return { ok: true, error: "cvUploadFailed" };
  return { ok: true };
}

export async function saveNotes(
  candidateId: string,
  notes: string,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = noteSchema.safeParse({ candidateId, notes });
  if (!parsed.success) return { error: "invalidInput" };
  const { data, error } = await scope
    .updateCandidate(parsed.data.candidateId, { notes: parsed.data.notes })
    .select("id");
  if (error || !data?.length) return { error: "generic" };
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
