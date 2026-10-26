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

  const counts = { candidates: 0, jobs: 0, failed: 0 };
  for (const c of candidates.data) {
    const result = await eraseCandidateData(
      c.organization_id,
      c.id,
      null,
      c.reason as ErasureReason,
    );
    if (result === "ok") counts.candidates++;
    else if (result !== "gone") counts.failed++;
  }
  for (const j of jobs.data) {
    if (await purgeJobData(j.id, null, "removed")) counts.jobs++;
    else counts.failed++;
  }
  return NextResponse.json(counts, { status: counts.failed ? 500 : 200 });
}
