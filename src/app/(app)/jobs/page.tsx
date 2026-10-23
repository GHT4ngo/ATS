import { getTranslations } from "next-intl/server";
import { JobFormDialog } from "@/components/jobs/job-form-dialog";
import { JobStatusSelect } from "@/components/jobs/job-status-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STAGES } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";

export default async function JobsPage() {
  const t = await getTranslations("Jobs");
  const s = await getTranslations("Stages");
  const scope = await getScope();

  const [{ data: jobs }, { data: apps }] = await Promise.all([
    scope.jobs().order("created_at", { ascending: false }),
    scope.applications().select("job_id, stage"),
  ]);

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
                  <JobFormDialog job={job} />
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
