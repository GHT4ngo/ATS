import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { CandidateDrawerLoader } from "@/components/candidates/candidate-drawer-loader";
import { FilterBar } from "@/components/filters/filter-bar";
import {
  KanbanBoard,
  type BoardCard,
  type BoardColumn,
} from "@/components/pipeline/kanban-board";
import { STAGES, compareStages } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; jobs?: string; candidate?: string }>;
}) {
  const { q, jobs: jobsParam, candidate } = await searchParams;
  const t = await getTranslations("Pipeline");
  const s = await getTranslations("Stages");
  const scope = await getScope();

  // Ids come from a shared URL, so drop anything that is not a uuid.
  const jobFilter = (jobsParam ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success);
  const term = q?.trim().toLowerCase();
  const latestScores = () =>
    scope.supabase
      .from("latest_cv_assessments")
      .select("candidate_id, job_id, score")
      .eq("organization_id", scope.orgId);

  const [
    { data: jobs },
    { data: candidates },
    { data: apps },
    { data: assessments },
    { data: stages },
  ] = await Promise.all([
    scope.jobs().order("title"),
    scope.candidates(),
    jobFilter.length
      ? scope.applications().in("job_id", jobFilter)
      : scope.applications(),
    jobFilter.length ? latestScores().in("job_id", jobFilter) : latestScores(),
    scope.jobStages(),
  ]);
  const stageById = new Map((stages ?? []).map((st) => [st.id, st]));

  // One job filtered: its own stages as columns. Otherwise the six phases.
  const mode = jobFilter.length === 1 ? "stage" : "phase";
  const columns: BoardColumn[] =
    mode === "stage"
      ? (stages ?? [])
          .filter((st) => st.job_id === jobFilter[0])
          .sort(compareStages)
          .map((st) => ({ id: st.id, label: st.name ?? s(st.phase) }))
      : STAGES.map((phase) => ({ id: phase, label: s(phase) }));
  const score = new Map(
    (assessments ?? []).map((a) => [`${a.candidate_id}:${a.job_id}`, a.score]),
  );

  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const byId = new Map((candidates ?? []).map((c) => [c.id, c]));

  const cards: BoardCard[] = (apps ?? []).flatMap((a) => {
    const cand = byId.get(a.candidate_id);
    if (!cand) return [];
    if (term && !cand.full_name.toLowerCase().includes(term)) return [];
    return [
      {
        id: a.id,
        candidateId: cand.id,
        name: cand.full_name,
        jobTitle: jobTitle.get(a.job_id) ?? "",
        stage: a.stage,
        column: mode === "stage" ? a.stage_id : a.stage,
        stageName:
          mode === "phase" ? (stageById.get(a.stage_id)?.name ?? null) : null,
        position: a.position,
        stageChangedAt: a.stage_changed_at,
        score: score.get(`${a.candidate_id}:${a.job_id}`) ?? null,
        linkedinUrl: cand.linkedin_url,
      },
    ];
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
      <FilterBar
        jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title }))}
      />
      <KanbanBoard
        key={mode === "stage" ? jobFilter[0] : "all"}
        initialCards={cards}
        columns={columns}
        mode={mode}
      />
      {candidate && (
        <CandidateDrawerLoader key={candidate} candidateId={candidate} />
      )}
    </div>
  );
}
