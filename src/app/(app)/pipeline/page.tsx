import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { CandidateDrawerLoader } from "@/components/candidates/candidate-drawer-loader";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filters/filter-bar";
import { JobBoard } from "@/components/pipeline/job-board";
import {
  KanbanBoard,
  type BoardCard,
  type BoardColumn,
} from "@/components/pipeline/kanban-board";
import { compareStages } from "@/lib/data/schemas";
import { daysSince, onBoard } from "@/lib/data/dashboard";
import { getScope } from "@/lib/data/scope";
import { latestScores, scoreKey } from "@/lib/data/scores";
import { parseMarks } from "@/lib/marks";
import { isMismatch } from "@/lib/phase-style";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    jobs?: string;
    marks?: string;
    candidate?: string;
  }>;
}) {
  const {
    q,
    jobs: jobsParam,
    marks: marksParam,
    candidate,
  } = await searchParams;
  const marks = parseMarks(marksParam);
  const t = await getTranslations("Pipeline");
  const s = await getTranslations("Stages");
  const j = await getTranslations("Jobs");
  const scope = await getScope();

  // Ids come from a shared URL, so drop anything that is not a uuid.
  const jobFilter = (jobsParam ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success);
  const term = q?.trim().toLowerCase();

  const [
    { data: jobs },
    { data: candidates },
    { data: apps },
    score,
    { data: stages },
  ] = await Promise.all([
    scope.jobs().order("title"),
    scope.candidates(),
    jobFilter.length
      ? scope.applications().in("job_id", jobFilter)
      : scope.applications(),
    latestScores(scope, jobFilter),
    scope.jobStages(),
  ]);
  const now = Date.now();
  const byId = new Map((candidates ?? []).map((c) => [c.id, c]));

  // Hires count archived cards too: a cleared card still filled an opening.
  const hiredOf = new Map<string, number>();
  for (const a of apps ?? [])
    if (a.stage === "hired")
      hiredOf.set(a.job_id, (hiredOf.get(a.job_id) ?? 0) + 1);

  const cardsOf = new Map<string, BoardCard[]>();
  for (const a of apps ?? []) {
    const cand = byId.get(a.candidate_id);
    if (!cand || !onBoard(a, now)) continue;
    if (term && !cand.full_name.toLowerCase().includes(term)) continue;
    const appScore = score.get(scoreKey(a.candidate_id, a.job_id)) ?? null;
    const mismatch = isMismatch(a.mismatch, appScore);
    if (marks.has("starred") && !a.starred) continue;
    if (marks.has("flagged") && !a.flagged) continue;
    if (marks.has("mismatch") && !mismatch) continue;
    const card: BoardCard = {
      id: a.id,
      candidateId: cand.id,
      name: cand.full_name,
      stage: a.stage,
      column: a.stage_id,
      position: a.position,
      days: daysSince(a.stage_changed_at, now),
      score: appScore,
      linkedinUrl: cand.linkedin_url,
      repoUrl: cand.repo_url,
      starred: a.starred,
      flagged: a.flagged,
      mismatch,
    };
    cardsOf.set(a.job_id, [...(cardsOf.get(a.job_id) ?? []), card]);
  }

  const columnsOf = (jobId: string): BoardColumn[] =>
    (stages ?? [])
      .filter((st) => st.job_id === jobId)
      .sort(compareStages)
      .map((st) => ({
        id: st.id,
        label: st.name ?? s(st.phase),
        phase: st.phase,
      }));

  const filled = (job: { id: string; openings: number }) =>
    (hiredOf.get(job.id) ?? 0) >= job.openings;
  // Jobs still hiring first, then filled and closed ones; by title within.
  const shown = (jobs ?? [])
    .filter((job) => !jobFilter.length || jobFilter.includes(job.id))
    .sort(
      (a, b) =>
        Number(filled(a) || a.status === "closed") -
          Number(filled(b) || b.status === "closed") ||
        a.title.localeCompare(b.title, "sv"),
    );
  const filtering = Boolean(term) || marks.size > 0;
  const visible = filtering ? shown.filter((job) => cardsOf.has(job.id)) : shown;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading")}
        </h1>
        <FilterBar
          jobs={(jobs ?? []).map((job) => ({ id: job.id, title: job.title }))}
          marks
        />
      </div>
      {visible.length ? (
        visible.map((job) => (
            <JobBoard
              key={job.id}
              jobId={job.id}
              title={job.title}
              meta={[
                job.location,
                job.status !== "open" && j(`status.${job.status}`),
              ]
                .filter(Boolean)
                .join(" · ")}
              cards={cardsOf.get(job.id)?.length ?? 0}
              hired={hiredOf.get(job.id) ?? 0}
              openings={job.openings}
              foldedByDefault={filled(job) || job.status === "closed"}
            >
              <KanbanBoard
                boardId={job.id}
                initialCards={cardsOf.get(job.id) ?? []}
                columns={columnsOf(job.id)}
              />
            </JobBoard>
          ))
      ) : (
        <EmptyState
          title={filtering ? t("noMatches") : t("noJobs")}
          hint={filtering ? t("noMatchesHint") : t("noJobsHint")}
        />
      )}
      {candidate && (
        <CandidateDrawerLoader key={candidate} candidateId={candidate} />
      )}
    </div>
  );
}
