"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { AssessmentError, assessCv, pdfToText } from "@/lib/ai/assess";
import { getScope } from "@/lib/data/scope";
import { createAdminClient } from "@/lib/supabase/admin";

/** Two clicks within this window run one assessment, not two. */
const COOLDOWN_MS = 30_000;

export async function assessApplication(
  applicationId: string,
): Promise<{ ok?: true; error?: string }> {
  const id = z.uuid().safeParse(applicationId);
  if (!id.success) return { error: "invalidInput" };
  const scope = await getScope();

  // Every read goes through the user's own session, so RLS decides access.
  const { data: app } = await scope
    .applications()
    .eq("id", id.data)
    .maybeSingle();
  if (!app) return { error: "generic" };
  const [{ data: candidate }, { data: job }, { data: recent }] =
    await Promise.all([
      scope.candidates().eq("id", app.candidate_id).maybeSingle(),
      scope.jobs().eq("id", app.job_id).maybeSingle(),
      scope
        .assessments()
        .eq("candidate_id", app.candidate_id)
        .eq("job_id", app.job_id)
        .gte("created_at", new Date(Date.now() - COOLDOWN_MS).toISOString())
        .limit(1),
    ]);
  if (!candidate || !job) return { error: "generic" };
  if (recent?.length) return { ok: true };
  if (!candidate.cv_path) return { error: "cvMissing" };

  const { data: file } = await scope.supabase.storage
    .from("cvs")
    .download(candidate.cv_path);
  if (!file) return { error: "cvUploadFailed" };

  try {
    const cv = await pdfToText(await file.arrayBuffer());
    const locale = (await getLocale()) === "en" ? "en" : "sv";
    const { result, model } = await assessCv({
      language: locale,
      title: job.title,
      description: job.description,
      cv,
    });

    // Users can only read assessments, so the row is written with the
    // service role, pinned to the organization checked above.
    const { error } = await createAdminClient()
      .from("cv_assessments")
      .insert({
        organization_id: scope.orgId,
        candidate_id: candidate.id,
        job_id: job.id,
        score: result.score,
        summary: result.summary.slice(0, 4000),
        strengths: result.strengths,
        gaps: result.gaps,
        skill_matches: result.skillMatches,
        interview_questions: result.interviewQuestions,
        model,
        created_by: scope.userId,
      });
    if (error) return { error: "generic" };
    await scope.log("application", app.id, "assessed", {
      score: result.score,
      job: job.title,
    });
  } catch (error) {
    if (error instanceof AssessmentError) return { error: error.code };
    console.error("CV assessment failed", error);
    return { error: "aiFailed" };
  }

  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  return { ok: true };
}
