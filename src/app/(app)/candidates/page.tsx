import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Flag, Star } from "lucide-react";
import { z } from "zod";
import { ScoreBadge } from "@/components/assessments/score-badge";
import { CandidateDrawerLoader } from "@/components/candidates/candidate-drawer-loader";
import { NewCandidateDialog } from "@/components/candidates/new-candidate-dialog";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filters/filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STAGES, type Stage } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";
import { parseMarks } from "@/lib/marks";
import { PHASE_STYLE, isMismatch } from "@/lib/phase-style";
import { cn, initials } from "@/lib/utils";

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
  const c = await getTranslations("Common");
  const s = await getTranslations("Stages");
  const m = await getTranslations("Marks");
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

  const [
    { data: candidates },
    { data: jobs },
    { data: apps },
    { data: scores },
  ] = await Promise.all([
    query,
    scope.jobs().order("title"),
    scope
      .applications()
      .select("id, candidate_id, job_id, stage, starred, flagged, mismatch"),
    scope.supabase
      .from("latest_cv_assessments")
      .select("candidate_id, job_id, score")
      .eq("organization_id", scope.orgId),
  ]);
  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const score = new Map(
    (scores ?? []).map((a) => [`${a.candidate_id}:${a.job_id}`, a.score]),
  );

  type App = NonNullable<typeof apps>[number] & {
    score: number | null;
    mismatch: boolean;
  };
  const appsOf = new Map<string, App[]>();
  for (const a of apps ?? []) {
    const appScore = score.get(`${a.candidate_id}:${a.job_id}`) ?? null;
    const row = {
      ...a,
      score: appScore,
      mismatch: isMismatch(a.mismatch, appScore),
    };
    appsOf.set(a.candidate_id, [...(appsOf.get(a.candidate_id) ?? []), row]);
  }
  const matches = (a: App) =>
    (!jobFilter.size || jobFilter.has(a.job_id)) &&
    (!phase || a.stage === phase) &&
    (!marks.has("starred") || a.starred) &&
    (!marks.has("flagged") || a.flagged) &&
    (!marks.has("mismatch") || a.mismatch);
  const filtering = jobFilter.size > 0 || marks.size > 0 || phase !== null;
  const list = (candidates ?? []).filter(
    (cand) => !filtering || (appsOf.get(cand.id) ?? []).some(matches),
  );

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

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("heading")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("count", { count: list.length })}
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
      {list.length ? (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>{c("name")}</TableHead>
                <TableHead>{t("jobs")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("location")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {c("created")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((cand) => {
                const candApps = appsOf.get(cand.id) ?? [];
                const mismatchAll =
                  candApps.length > 0 && candApps.every((a) => a.mismatch);
                return (
                  <TableRow
                    key={cand.id}
                    className={cn(
                      mismatchAll && "bg-rose-50/60 dark:bg-rose-950/20",
                    )}
                  >
                    <TableCell>
                      <Link
                        href={drawerHref(cand.id)}
                        scroll={false}
                        className="flex items-center gap-3"
                      >
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                          aria-hidden
                        >
                          {initials(cand.full_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 font-medium hover:underline">
                            {cand.full_name}
                            {candApps.some((a) => a.starred) && (
                              <Star
                                className="size-3.5 fill-amber-400 text-amber-500"
                                aria-label={m("starred")}
                              />
                            )}
                            {candApps.some((a) => a.flagged) && (
                              <Flag
                                className="size-3.5 fill-current text-rose-600 dark:text-rose-400"
                                aria-label={m("flagged")}
                              />
                            )}
                          </span>
                          {cand.email && (
                            <span className="text-muted-foreground block max-w-56 truncate text-xs">
                              {cand.email}
                            </span>
                          )}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {candApps.map((a) => (
                          <span
                            key={a.id}
                            title={`${jobTitle.get(a.job_id)} · ${s(a.stage)}`}
                            className={cn(
                              "inline-flex h-6 max-w-56 items-center gap-1.5 rounded-full px-2 text-xs",
                              PHASE_STYLE[a.stage].soft,
                              a.mismatch &&
                                "ring-1 ring-rose-400 dark:ring-rose-700",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                PHASE_STYLE[a.stage].dot,
                              )}
                              aria-hidden
                            />
                            <span className="truncate">
                              {jobTitle.get(a.job_id)}
                            </span>
                            <span className="opacity-70">{s(a.stage)}</span>
                            {a.score !== null && (
                              <ScoreBadge
                                score={a.score}
                                label={ai("scoreLabel", { score: a.score })}
                                className="h-4 px-1.5"
                              />
                            )}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {cand.location ?? ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {format.dateTime(new Date(cand.created_at), {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
