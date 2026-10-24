import "server-only";
import type { getScope } from "./scope";
import { allRows } from "./paging";

type Scope = Awaited<ReturnType<typeof getScope>>;

export const scoreKey = (candidateId: string, jobId: string) =>
  `${candidateId}:${jobId}`;

/** The latest AI score per candidate and job, keyed with scoreKey. */
export async function latestScores(scope: Scope, jobIds?: string[]) {
  const { data } = await allRows((from, to) => {
    let q = scope.supabase
      .from("latest_cv_assessments")
      .select("candidate_id, job_id, score")
      .eq("organization_id", scope.orgId);
    if (jobIds?.length) q = q.in("job_id", jobIds);
    return q.order("candidate_id").order("job_id").range(from, to);
  });
  const map = new Map<string, number>();
  for (const a of data)
    if (a.candidate_id && a.job_id && a.score !== null)
      map.set(scoreKey(a.candidate_id, a.job_id), a.score);
  return map;
}
