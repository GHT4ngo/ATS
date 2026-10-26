import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  REMOVED_DAYS,
  RETENTION_MONTHS,
  eraseCandidateData,
  purgeJobData,
  type ErasureReason,
} from "@/lib/data/erase";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PER_RUN = 200;
const BATCH = 5;

async function inBatches(runs: (() => Promise<boolean>)[]) {
  const results: boolean[] = [];
  for (let i = 0; i < runs.length; i += BATCH)
    results.push(
      ...(await Promise.all(runs.slice(i, i + BATCH).map((r) => r()))),
    );
  return results;
}

/**
 * Daily retention job, called by Vercel Cron with the CRON_SECRET as a bearer
 * token. Erases candidates and jobs removed more than REMOVED_DAYS ago, and
 * candidates with no activity for RETENTION_MONTHS.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    given.length !== wanted.length ||
    !timingSafeEqual(given, wanted)
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [candidates, jobs] = await Promise.all([
    admin.rpc("expired_candidates", {
      p_removed_days: REMOVED_DAYS,
      p_retention_months: RETENTION_MONTHS,
    }),
    admin.rpc("expired_jobs", { p_removed_days: REMOVED_DAYS }),
  ]);
  if (candidates.error || jobs.error) {
    console.error("Retention lookup failed", candidates.error ?? jobs.error);
    return NextResponse.json({ error: "lookup" }, { status: 500 });
  }

  // A few at a time, and at most MAX_PER_RUN a night, so a large backlog
  // cannot run past the function time limit; the rest waits for tomorrow.
  const counts = { candidates: 0, jobs: 0, failed: 0 };
  const candidateRuns = candidates.data
    .slice(0, MAX_PER_RUN)
    .map(
      (c) => () =>
        eraseCandidateData(
          c.organization_id,
          c.id,
          null,
          c.reason as ErasureReason,
        ),
    );
  for (const ok of await inBatches(candidateRuns))
    if (ok) counts.candidates++;
    else counts.failed++;
  const jobRuns = jobs.data
    .slice(0, MAX_PER_RUN)
    .map((j) => () => purgeJobData(j.id, null, "removed"));
  for (const ok of await inBatches(jobRuns))
    if (ok) counts.jobs++;
    else counts.failed++;
  return NextResponse.json(counts, { status: counts.failed ? 500 : 200 });
}
