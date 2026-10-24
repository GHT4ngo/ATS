import { z } from "zod";
import type { AssessmentView } from "@/components/assessments/assessment-panel";
import { getScope } from "@/lib/data/scope";
import { isMismatch } from "@/lib/phase-style";
import type { Database } from "@/lib/supabase/database.types";
import { CandidateDrawer } from "./candidate-drawer";

/** Loads one candidate for the drawer. Renders nothing for a bad or foreign id. */
export async function CandidateDrawerLoader({
  candidateId,
}: {
  candidateId: string;
}) {
  const id = z.uuid().safeParse(candidateId);
  if (!id.success) return null;
  const scope = await getScope();

  const { data: candidate } = await scope
    .candidates()
    .eq("id", id.data)
    .maybeSingle();
  if (!candidate) return null;

  const [{ data: apps }, { data: jobs }, { data: assessments }] =
    await Promise.all([
      scope.applications().eq("candidate_id", candidate.id),
      scope.jobs().order("title"),
      scope.latestAssessments().eq("candidate_id", candidate.id),
    ]);
  const latest = new Map((assessments ?? []).map((a) => [a.job_id, a]));
  const { data: stages } = (apps ?? []).length
    ? await scope.jobStages().in(
        "id",
        (apps ?? []).map((a) => a.stage_id),
      )
    : { data: [] };
  const stageName = new Map((stages ?? []).map((st) => [st.id, st.name]));
  const appIds = (apps ?? []).map((a) => a.id);
  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));

  const filter = [
    `and(entity.eq.candidate,entity_id.eq.${candidate.id})`,
    ...(appIds.length
      ? [`and(entity.eq.application,entity_id.in.(${appIds.join(",")}))`]
      : []),
  ].join(",");
  const { data: log } = await scope.supabase
    .from("activity_log")
    .select("*")
    .eq("organization_id", scope.orgId)
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(50);

  const actorIds = [
    ...new Set((log ?? []).map((l) => l.actor_id).filter(Boolean)),
  ];
  const { data: actors } = actorIds.length
    ? await scope.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds as string[])
    : { data: [] };
  const actorName = new Map(
    (actors ?? []).map((a) => [a.id, a.full_name || a.email || null]),
  );

  return (
    <CandidateDrawer
      candidate={{
        id: candidate.id,
        full_name: candidate.full_name,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
        linkedin_url: candidate.linkedin_url,
        jobIds: (apps ?? []).map((a) => a.job_id),
        hasCv: Boolean(candidate.cv_path),
      }}
      notes={candidate.notes}
      jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title }))}
      applications={(apps ?? []).map((a) => ({
        id: a.id,
        jobTitle: jobTitle.get(a.job_id) ?? "",
        stage: a.stage,
        stageName: stageName.get(a.stage_id) ?? null,
        stageChangedAt: a.stage_changed_at,
        assessment: toView(latest.get(a.job_id)),
        starred: a.starred,
        flagged: a.flagged,
        mismatch: a.mismatch,
        effectiveMismatch: isMismatch(
          a.mismatch,
          latest.get(a.job_id)?.score ?? null,
        ),
      }))}
      activity={(log ?? []).map((l) => ({
        id: l.id,
        action: l.action,
        payload: (l.payload ?? {}) as Record<string, unknown>,
        createdAt: l.created_at,
        actor: l.actor_id ? (actorName.get(l.actor_id) ?? null) : null,
      }))}
    />
  );
}

type LatestRow = Database["public"]["Views"]["latest_cv_assessments"]["Row"];

// View columns are typed as nullable, but each one comes from a not null column.
function toView(row: LatestRow | undefined): AssessmentView | null {
  if (!row || row.score === null || row.created_at === null) return null;
  return {
    score: row.score,
    summary: row.summary ?? "",
    strengths: (row.strengths ?? []) as string[],
    gaps: (row.gaps ?? []) as string[],
    skillMatches: (row.skill_matches ?? []) as AssessmentView["skillMatches"],
    interviewQuestions: (row.interview_questions ?? []) as string[],
    model: row.model ?? "",
    createdAt: row.created_at,
  };
}
