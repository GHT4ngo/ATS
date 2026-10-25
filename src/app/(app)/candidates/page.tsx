import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Inbox, UserRound } from "lucide-react";
import { z } from "zod";
import { ScoreBadge } from "@/components/assessments/score-badge";
import { CandidateDrawerLoader } from "@/components/candidates/candidate-drawer-loader";
import { NewCandidateDialog } from "@/components/candidates/new-candidate-dialog";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filters/filter-bar";
import { FoldSection } from "@/components/fold-section";
import { ProfileLinks } from "@/components/profile-links";
import { Signal } from "@/components/signals";
import { STUCK_DAYS, daysSince, isActive } from "@/lib/data/dashboard";
import { STAGES, type Stage } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";
import { latestScores, scoreKey } from "@/lib/data/scores";
import { parseMarks } from "@/lib/marks";
import { PHASE_STYLE, isMismatch } from "@/lib/phase-style";
import { cn, initials } from "@/lib/utils";

/** Applications this new show in the list at the top. */
const NEW_DAYS = 7;
const STORAGE_KEY = "ats.candidates.sections";

/** Hired at the top, then down the process, with rejected last. */
const ORDER: Stage[] = [
  "hired",
  "offer",
  "interview",
  "screening",
  "applied",
  "rejected",
];

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    jobs?: string;
    marks?: string;
    phase?: string;
    candidate?: string;
  }>;
}) {
  const params = await searchParams;
  const { q, candidate } = params;
  const t = await getTranslations("Candidates");
  const s = await getTranslations("Stages");
  const ai = await getTranslations("Assessment");
  const format = await getFormatter();
  const scope = await getScope();

  const jobFilter = new Set(
    (params.jobs ?? "")
      .split(",")
      .filter((id) => z.uuid().safeParse(id).success),
  );
  const marks = parseMarks(params.marks);
  const phase = (STAGES as readonly string[]).includes(params.phase ?? "")
    ? (params.phase as Stage)
    : null;

  let query = scope.candidates().order("created_at", { ascending: false });
  const term = q?.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.ilike("full_name", `%${term}%`);

  const [{ data: candidates }, { data: jobs }, { data: apps }, score] =
    await Promise.all([
      query,
      scope.jobs().order("title"),
      scope
        .applications()
        .select(
          "id, candidate_id, job_id, stage, stage_changed_at, created_at, starred, flagged, mismatch",
        ),
      latestScores(scope),
    ]);
  const now = Date.now();
  const byId = new Map((candidates ?? []).map((c) => [c.id, c]));
  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));

  type Row = NonNullable<typeof apps>[number] & {
    cand: NonNullable<typeof candidates>[number];
    score: number | null;
    mismatch: boolean;
    days: number;
  };
  const rows: Row[] = (apps ?? []).flatMap((a) => {
    const cand = byId.get(a.candidate_id);
    if (!cand) return [];
    const appScore = score.get(scoreKey(a.candidate_id, a.job_id)) ?? null;
    return [
      {
        ...a,
        cand,
        score: appScore,
        mismatch: isMismatch(a.mismatch, appScore),
        days: daysSince(a.stage_changed_at, now),
      },
    ];
  });
  const matches = (r: Row) =>
    (!jobFilter.size || jobFilter.has(r.job_id)) &&
    (!phase || r.stage === phase) &&
    (!marks.has("starred") || r.starred) &&
    (!marks.has("flagged") || r.flagged) &&
    (!marks.has("mismatch") || r.mismatch);
  const filtering = jobFilter.size > 0 || marks.size > 0 || phase !== null;
  const shown = rows
    .filter(matches)
    .sort(
      (a, b) =>
        ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) ||
        a.cand.full_name.localeCompare(b.cand.full_name, "sv"),
    );

  const fresh = shown
    .filter((r) => daysSince(r.created_at, now) < NEW_DAYS)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const perJob = (jobs ?? [])
    .map((job) => ({ job, rows: shown.filter((r) => r.job_id === job.id) }))
    .filter((g) => g.rows.length || (!filtering && !term));
  // Candidates with no application yet; hidden while filtering on jobs or marks.
  const withApps = new Set(rows.map((r) => r.candidate_id));
  const loose = filtering
    ? []
    : (candidates ?? []).filter((c) => !withApps.has(c.id));
  const count = new Set([
    ...shown.map((r) => r.candidate_id),
    ...loose.map((c) => c.id),
  ]).size;

  const drawerHref = (id: string) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([k, v]) => k !== "candidate" && v) as [
        string,
        string,
      ][],
    );
    next.set("candidate", id);
    return `/candidates?${next}`;
  };

  const person = (
    cand: { id: string; full_name: string; email: string | null },
    tone: string,
    sub?: string,
  ) => (
    <Link
      href={drawerHref(cand.id)}
      scroll={false}
      className="flex min-w-0 items-center gap-3"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone,
        )}
        aria-hidden
      >
        {initials(cand.full_name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium hover:underline">
          {cand.full_name}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {sub ?? cand.email ?? ""}
        </span>
      </span>
    </Link>
  );

  const signals = (r: Row) => (
    <span className="flex items-center gap-2.5">
      {r.starred && <Signal kind="starred" />}
      {r.flagged && <Signal kind="flagged" />}
      {r.mismatch && <Signal kind="mismatch" />}
      {r.score === null &&
        r.cand.cv_path &&
        (r.stage === "applied" || r.stage === "screening") && (
          <Signal kind="unassessed" />
        )}
      {isActive(r.stage) && (
        <Signal kind={r.days > STUCK_DAYS ? "stuck" : "days"} days={r.days} />
      )}
    </span>
  );

  const phaseChip = (stage: Stage) => (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        PHASE_STYLE[stage].soft,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", PHASE_STYLE[stage].dot)}
        aria-hidden
      />
      {s(stage)}
    </span>
  );

  const list = (items: Row[], withJob: boolean) => (
    <ul className="divide-border/60 divide-y">
      {items.map((r) => (
        <li
          key={r.id}
          className={cn(
            "hover:bg-muted/40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2 text-sm md:grid-cols-[minmax(0,1.4fr)_7.5rem_minmax(0,1fr)_auto]",
            r.stage === "rejected" && "opacity-55 grayscale-[0.6]",
            r.mismatch && r.stage !== "rejected" && "bg-rose-500/[0.05]",
          )}
        >
          {person(
            r.cand,
            r.mismatch
              ? "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 ring-inset dark:text-rose-300"
              : PHASE_STYLE[r.stage].soft,
            withJob ? jobTitle.get(r.job_id) : undefined,
          )}
          <span className="justify-self-end md:justify-self-start">
            {phaseChip(r.stage)}
          </span>
          <span className="hidden items-center gap-3 md:flex">
            {r.score !== null && (
              <ScoreBadge
                score={r.score}
                label={ai("scoreLabel", { score: r.score })}
              />
            )}
            {signals(r)}
          </span>
          <span className="col-span-2 flex items-center gap-3 md:col-span-1 md:justify-end">
            <span className="flex items-center gap-3 md:hidden">
              {r.score !== null && (
                <ScoreBadge
                  score={r.score}
                  label={ai("scoreLabel", { score: r.score })}
                />
              )}
              {signals(r)}
            </span>
            <ProfileLinks
              linkedinUrl={r.cand.linkedin_url}
              repoUrl={r.cand.repo_url}
            />
            <span className="text-muted-foreground hidden w-20 text-right text-xs lg:inline">
              {format.dateTime(new Date(r.created_at), {
                day: "numeric",
                month: "short",
              })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );

  const phaseCounts = (items: Row[]) => (
    <span className="hidden items-center gap-1 sm:flex">
      {ORDER.map((st) => {
        const n = items.filter((r) => r.stage === st).length;
        return n ? (
          <span
            key={st}
            title={`${s(st)}: ${n}`}
            className={cn(
              "inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs leading-5 font-medium tabular-nums",
              PHASE_STYLE[st].soft,
            )}
          >
            {n}
          </span>
        ) : null;
      })}
    </span>
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("heading")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("count", { count })}
          </p>
        </div>
        <NewCandidateDialog
          jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title }))}
        />
      </div>
      <FilterBar
        jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title }))}
        marks
        phases
      />

      {shown.length || loose.length ? (
        <>
          {fresh.length > 0 && (
            <FoldSection
              id="new"
              storageKey={STORAGE_KEY}
              title={t("newHeading")}
              meta={t("newNote", { days: NEW_DAYS })}
              icon={
                <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-300">
                  <Inbox className="size-4" />
                </span>
              }
              aside={
                <span className="rounded-full bg-sky-500/10 px-2 text-xs leading-5 font-medium text-sky-700 tabular-nums ring-1 ring-sky-500/20 ring-inset dark:text-sky-300">
                  {fresh.length}
                </span>
              }
              className="bg-gradient-to-b from-sky-500/[0.05] to-transparent"
            >
              {list(fresh, true)}
            </FoldSection>
          )}
          {perJob.map(({ job, rows: items }) => (
            <FoldSection
              key={job.id}
              id={job.id}
              storageKey={STORAGE_KEY}
              title={job.title}
              meta={t("count", {
                count: new Set(items.map((r) => r.candidate_id)).size,
              })}
              aside={phaseCounts(items)}
            >
              {items.length ? (
                list(items, false)
              ) : (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                  {t("noApplicants")}
                </p>
              )}
            </FoldSection>
          ))}
          {loose.length > 0 && (
            <FoldSection
              id="none"
              storageKey={STORAGE_KEY}
              title={t("noJobHeading")}
              meta={t("count", { count: loose.length })}
              icon={
                <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                  <UserRound className="size-4" />
                </span>
              }
            >
              <ul className="divide-border/60 divide-y">
                {loose.map((cand) => (
                  <li key={cand.id} className="px-2 py-2 text-sm">
                    {person(cand, "bg-muted text-muted-foreground")}
                  </li>
                ))}
              </ul>
            </FoldSection>
          )}
        </>
      ) : (
        <EmptyState
          title={filtering || term ? t("noMatches") : t("empty")}
          hint={filtering || term ? t("noMatchesHint") : t("emptyHint")}
        />
      )}
      {candidate && (
        <CandidateDrawerLoader key={candidate} candidateId={candidate} />
      )}
    </div>
  );
}
