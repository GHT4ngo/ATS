import { NextResponse } from "next/server";
import { z } from "zod";
import { getScope } from "@/lib/data/scope";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Everything stored about one candidate, as a JSON download, for a GDPR
 * access or portability request. The CV file is downloaded on its own from
 * the profile. The caller must be able to see the candidate; the rest is
 * read through the service role, so rows hidden by a removed job are still
 * included while they are stored.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "invalidInput" }, { status: 400 });
  const scope = await getScope();

  const { data: candidate } = await scope
    .candidates()
    .eq("id", id.data)
    .maybeSingle();
  if (!candidate)
    return NextResponse.json({ error: "notFound" }, { status: 404 });

  const admin = createAdminClient();
  const [{ data: apps }, { data: jobs }, { data: assessments }] =
    await Promise.all([
      admin
        .from("applications")
        .select("*")
        .eq("organization_id", scope.orgId)
        .eq("candidate_id", candidate.id),
      admin.from("jobs").select("id, title").eq("organization_id", scope.orgId),
      admin
        .from("cv_assessments")
        .select(
          "job_id, score, summary, strengths, gaps, skill_matches, interview_questions, model, created_at",
        )
        .eq("organization_id", scope.orgId)
        .eq("candidate_id", candidate.id)
        .order("created_at"),
    ]);
  const appIds = (apps ?? []).map((a) => a.id);
  const filter = [
    `and(entity.eq.candidate,entity_id.eq.${candidate.id})`,
    ...(appIds.length
      ? [`and(entity.eq.application,entity_id.in.(${appIds.join(",")}))`]
      : []),
  ].join(",");
  const { data: log } = await admin
    .from("activity_log")
    .select("entity, action, payload, created_at")
    .eq("organization_id", scope.orgId)
    .or(filter)
    .order("created_at");
  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));

  await scope.log("candidate", candidate.id, "exported");

  const body = {
    exported_at: new Date().toISOString(),
    candidate: {
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      location: candidate.location,
      linkedin_url: candidate.linkedin_url,
      repo_url: candidate.repo_url,
      notes: candidate.notes,
      has_cv_file: Boolean(candidate.cv_path),
      created_at: candidate.created_at,
      updated_at: candidate.updated_at,
    },
    applications: (apps ?? []).map((a) => ({
      job: jobTitle.get(a.job_id) ?? null,
      stage: a.stage,
      rating: a.rating,
      starred: a.starred,
      flagged: a.flagged,
      archived_at: a.archived_at,
      applied_at: a.created_at,
      stage_changed_at: a.stage_changed_at,
    })),
    cv_assessments: (assessments ?? []).map(({ job_id, ...rest }) => ({
      job: jobTitle.get(job_id) ?? null,
      ...rest,
    })),
    activity: log ?? [],
  };
  // An ASCII name for old clients, the real one in filename*.
  const name = candidate.full_name.replace(/[^\p{L}\p{N}]+/gu, "_");
  const ascii = name.normalize("NFD").replace(/[^A-Za-z0-9_]/g, "");
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidate_${ascii}.json"; filename*=UTF-8''candidate_${encodeURIComponent(name)}.json`,
      "Cache-Control": "no-store",
    },
  });
}
