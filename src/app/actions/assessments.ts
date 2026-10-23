"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { AssessmentError, assessCv, pdfToText } from "@/lib/ai/assess";
import { getScope } from "@/lib/data/scope";
import { createAdminClient } from "@/lib/supabase/admin";

/** A claim older than this belongs to a crashed run and may be taken over. */
const STALE_LOCK_SECONDS = 180;

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
  const [{ data: candidate }, { data: job }] = await Promise.all([
    scope.candidates().eq("id", app.candidate_id).maybeSingle(),
    scope.jobs().eq("id", app.job_id).maybeSingle(),
  ]);
  if (!candidate || !job) return { error: "generic" };
  if (!candidate.cv_path) return { error: "cvMissing" };

  // Claim the pair before the paid Claude call, so a second click or tab
  // gets "already running" instead of a duplicate run.
  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_cv_assessment",
    {
      p_candidate: candidate.id,
      p_job: job.id,
      p_stale_seconds: STALE_LOCK_SECONDS,
    },
  );
  if (claimError) {
    console.error("CV assessment claim failed", claimError);
    return { error: "generic" };
  }
  if (!claimed) return { error: "assessmentRunning" };

  try {
    const { data: file } = await scope.supabase.storage
      .from("cvs")
      .download(candidate.cv_path);
    if (!file) return { error: "cvDownloadFailed" };

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
    const { error } = await admin.from("cv_assessments").insert({
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
    if (error) {
      console.error("CV assessment insert failed", error);
      return { error: "generic" };
    }
    const { error: logError } = await scope.log(
      "application",
      app.id,
      "assessed",
      { score: result.score, job: job.title },
    );
    if (logError) console.error("CV assessment log failed", logError);
  } catch (error) {
    if (error instanceof AssessmentError) return { error: error.code };
    console.error("CV assessment failed", error);
    return { error: "aiFailed" };
  } finally {
    await admin
      .from("cv_assessment_locks")
      .delete()
      .eq("candidate_id", candidate.id)
      .eq("job_id", job.id);
  }

  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  return { ok: true };
}
