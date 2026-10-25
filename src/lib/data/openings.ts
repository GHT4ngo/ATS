/** Hires per job, from rows that carry a job id and a stage. */
export function hiresByJob(apps: { job_id: string; stage: string }[]) {
  const hired = new Map<string, number>();
  for (const a of apps)
    if (a.stage === "hired")
      hired.set(a.job_id, (hired.get(a.job_id) ?? 0) + 1);
  return hired;
}

/** A job with as many hires as openings is filled, whatever its status. */
export function isFilled(
  job: { id: string; openings: number },
  hired: Map<string, number>,
) {
  return (hired.get(job.id) ?? 0) >= job.openings;
}

/** Open for applications and still hiring. */
export function isHiring(
  job: { id: string; status: string; openings: number },
  hired: Map<string, number>,
) {
  return job.status === "open" && !isFilled(job, hired);
}
