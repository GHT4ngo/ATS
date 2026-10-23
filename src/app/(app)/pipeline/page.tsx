import { getTranslations } from "next-intl/server";
import { CandidateDrawerLoader } from "@/components/candidates/candidate-drawer-loader";
import { FilterBar } from "@/components/filters/filter-bar";
import {
  KanbanBoard,
  type BoardCard,
} from "@/components/pipeline/kanban-board";
import { getScope } from "@/lib/data/scope";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; jobs?: string; candidate?: string }>;
}) {
  const { q, jobs: jobsParam, candidate } = await searchParams;
  const t = await getTranslations("Pipeline");
  const scope = await getScope();

  const jobFilter = (jobsParam ?? "").split(",").filter(Boolean);
  const term = q?.trim().toLowerCase();

  const [{ data: jobs }, { data: candidates }, { data: apps }] =
    await Promise.all([
      scope.jobs().order("title"),
      scope.candidates(),
      jobFilter.length
        ? scope.applications().in("job_id", jobFilter)
        : scope.applications(),
    ]);

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
        position: a.position,
        stageChangedAt: a.stage_changed_at,
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
      <KanbanBoard initialCards={cards} />
      {candidate && (
        <CandidateDrawerLoader key={candidate} candidateId={candidate} />
      )}
    </div>
  );
}
