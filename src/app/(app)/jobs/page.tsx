import { getTranslations } from "next-intl/server";
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
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("heading")}
        </h1>
        <JobFormDialog />
      </div>
      {jobs?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("title")}</TableHead>
              <TableHead>{t("statusLabel")}</TableHead>
              {STAGES.map((st) => (
                <TableHead key={st} className="text-right">
                  {s(st)}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <div className="font-medium">{job.title}</div>
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
                  <TableCell key={st} className="text-right tabular-nums">
                    {counts.get(job.id)?.[st] ?? 0}
                  </TableCell>
                ))}
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
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </div>
  );
}
