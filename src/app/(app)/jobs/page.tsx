import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { JobFormDialog } from "@/components/jobs/job-form-dialog";
import {
  JobStagesDialog,
  type StageRow,
} from "@/components/jobs/job-stages-dialog";
import { JobStatusSelect } from "@/components/jobs/job-status-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STAGES, compareStages } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";
import { PHASE_STYLE } from "@/lib/phase-style";
import { cn } from "@/lib/utils";

export default async function JobsPage() {
  const t = await getTranslations("Jobs");
  const s = await getTranslations("Stages");
  const scope = await getScope();

  const [{ data: jobs }, { data: apps }, { data: stages }] = await Promise.all([
    scope.jobs().order("created_at", { ascending: false }),
    scope.supabase
      .from("applications")
      .select("job_id, stage, stage_id")
      .eq("organization_id", scope.orgId),
    scope.jobStages(),
  ]);
  const perStage = new Map<string, number>();
  for (const a of apps ?? [])
    perStage.set(a.stage_id, (perStage.get(a.stage_id) ?? 0) + 1);
  const stagesOf = (jobId: string): StageRow[] =>
    (stages ?? [])
      .filter((st) => st.job_id === jobId)
      .sort(compareStages)
      .map((st) => ({
        id: st.id,
        name: st.name,
        phase: st.phase,
        candidates: perStage.get(st.id) ?? 0,
      }));

  const counts = new Map<string, Record<string, number>>();
  for (const a of apps ?? []) {
    const row = counts.get(a.job_id) ?? {};
    row[a.stage] = (row[a.stage] ?? 0) + 1;
    counts.set(a.job_id, row);
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading")}
        </h1>
        <JobFormDialog />
      </div>
      {jobs?.length ? (
        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("statusLabel")}</TableHead>
                {STAGES.map((st) => (
                  <TableHead
                    key={st}
                    className="hidden text-right lg:table-cell"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          PHASE_STYLE[st].dot,
                        )}
                        aria-hidden
                      />
                      {s(st)}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="lg:hidden">{t("candidates")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const row = counts.get(job.id) ?? {};
                const total = STAGES.reduce((n, st) => n + (row[st] ?? 0), 0);
                const board = `/pipeline?jobs=${job.id}`;
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={board}
                        className="font-medium hover:underline"
                      >
                        {job.title}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {[job.location, t(`type.${job.employment_type}`)]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <JobStatusSelect
                        jobId={job.id}
                        status={job.status}
                        label={t("statusLabel")}
                      />
                    </TableCell>
                    {STAGES.map((st) => (
                      <TableCell
                        key={st}
                        className="hidden text-right lg:table-cell"
                      >
                        {row[st] ? (
                          <Link
                            href={`/candidates?jobs=${job.id}&phase=${st}`}
                            aria-label={`${s(st)}: ${row[st]}`}
                            className={cn(
                              "inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                              PHASE_STYLE[st].soft,
                            )}
                          >
                            {row[st]}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground/60 px-2 text-xs tabular-nums">
                            0
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="lg:hidden">
                      <Link
                        href={board}
                        className="bg-muted flex h-2 w-24 overflow-hidden rounded-full"
                        aria-label={t("candidatesCount", { count: total })}
                        title={STAGES.map(
                          (st) => `${s(st)}: ${row[st] ?? 0}`,
                        ).join(", ")}
                      >
                        {STAGES.map((st) =>
                          row[st] ? (
                            <span
                              key={st}
                              className={PHASE_STYLE[st].dot}
                              style={{ width: `${(row[st] / total) * 100}%` }}
                            />
                          ) : null,
                        )}
                      </Link>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t("candidatesCount", { count: total })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <JobStagesDialog
                          jobId={job.id}
                          jobTitle={job.title}
                          stages={stagesOf(job.id)}
                        />
                        <JobFormDialog job={job} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title={t("empty")} hint={t("emptyHint")} />
      )}
    </div>
  );
}
