import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { STAGES } from "@/lib/data/schemas";
import type { getScope } from "@/lib/data/scope";

type Scope = Awaited<ReturnType<typeof getScope>>;

/** Applications that sit this long in an active stage count as stalled. */
const STALLED_DAYS = 14;
const ACTIVE_STAGES = ["applied", "screening", "interview", "offer"];

const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

const inputs = {
  search_candidates: z.object({
    query: z.string().max(100).optional(),
    job_id: z.uuid().optional(),
    stage: z.enum(STAGES).optional(),
  }),
  get_candidate: z.object({ candidate_id: z.uuid() }),
  list_jobs: z.object({}),
  pipeline_summary: z.object({ job_id: z.uuid().optional() }),
  move_candidate: z.object({
    application_id: z.uuid(),
    stage: z.enum(STAGES),
  }),
};

export type ToolName = keyof typeof inputs;

/** Tools that change data. The loop pauses for the user's approval first. */
export const NEEDS_APPROVAL: ReadonlySet<string> = new Set(["move_candidate"]);

const uuid = { type: "string", format: "uuid" } as const;
const stage = { type: "string", enum: [...STAGES] } as const;

const definitions: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_candidates",
    description:
      "Find candidates in the organization. All filters are optional and combine. Returns at most 25 candidates with their applications (application_id, job, stage, days in stage, latest AI score).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of the candidate's name" },
        job_id: {
          ...uuid,
          description: "Only candidates who applied to this job",
        },
        stage: { ...stage, description: "Only applications in this stage" },
      },
    },
  },
  {
    name: "get_candidate",
    description:
      "Full profile of one candidate: contact details, notes, every application with its latest AI assessment, and recent activity.",
    input_schema: {
      type: "object",
      properties: { candidate_id: uuid },
      required: ["candidate_id"],
    },
  },
  {
    name: "list_jobs",
    description:
      "All jobs in the organization with status, location and the number of candidates per stage.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "pipeline_summary",
    description: `Counts per stage, average AI score and stalled applications (more than ${STALLED_DAYS} days in an active stage), for one job or all jobs.`,
    input_schema: {
      type: "object",
      properties: {
        job_id: { ...uuid, description: "Leave out for all jobs" },
      },
    },
  },
  {
    name: "move_candidate",
    description:
      "Move one application to another stage. The user is asked to approve the move before it happens; call it only when the user asked for a move.",
    input_schema: {
      type: "object",
      properties: { application_id: uuid, stage },
      required: ["application_id", "stage"],
    },
  },
];

export const TOOLS: Anthropic.Beta.BetaTool[] = definitions.map((tool) => ({
  ...tool,
  eager_input_streaming: true,
}));

export type PendingAction = {
  toolUseId: string;
  candidate: string;
  job: string;
  from: string;
  to: string;
};

export class ToolInputError extends Error {}

export function parseInput<T extends ToolName>(name: T, input: unknown) {
  const schema = inputs[name];
  if (!schema) throw new ToolInputError(`Unknown tool ${name}`);
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) throw new ToolInputError(parsed.error.message);
  return parsed.data as z.infer<(typeof inputs)[T]>;
}

export function isToolName(name: string): name is ToolName {
  return name in inputs;
}

async function loadContext(scope: Scope) {
  const [
    { data: jobs },
    { data: candidates },
    { data: apps },
    { data: scores },
  ] = await Promise.all([
    scope.jobs(),
    scope.candidates(),
    scope.applications(),
    scope.supabase
      .from("latest_cv_assessments")
      .select("candidate_id, job_id, score")
      .eq("organization_id", scope.orgId),
  ]);
  const score = new Map(
    (scores ?? []).map((s) => [`${s.candidate_id}:${s.job_id}`, s.score]),
  );
  return {
    jobs: jobs ?? [],
    jobTitle: new Map((jobs ?? []).map((j) => [j.id, j.title])),
    candidates: candidates ?? [],
    candidateName: new Map((candidates ?? []).map((c) => [c.id, c.full_name])),
    apps: apps ?? [],
    score: (candidateId: string, jobId: string) =>
      score.get(`${candidateId}:${jobId}`) ?? null,
  };
}

/** Describes a pending move for the approval card, or null if it is invalid. */
export async function describeMove(
  scope: Scope,
  toolUseId: string,
  input: unknown,
): Promise<PendingAction | null> {
  let parsed;
  try {
    parsed = parseInput("move_candidate", input);
  } catch {
    return null;
  }
  const { data: app } = await scope
    .applications()
    .eq("id", parsed.application_id)
    .maybeSingle();
  if (!app) return null;
  const [{ data: cand }, { data: job }] = await Promise.all([
    scope.candidates().eq("id", app.candidate_id).maybeSingle(),
    scope.jobs().eq("id", app.job_id).maybeSingle(),
  ]);
  return {
    toolUseId,
    candidate: cand?.full_name ?? "",
    job: job?.title ?? "",
    from: app.stage,
    to: parsed.stage,
  };
}

/** Runs one tool as the signed in user. Returns JSON for the tool result. */
export async function runTool(
  scope: Scope,
  name: ToolName,
  input: unknown,
): Promise<{ result: unknown; changed?: boolean }> {
  switch (name) {
    case "search_candidates": {
      const { query, job_id, stage } = parseInput(name, input);
      const ctx = await loadContext(scope);
      const q = query?.trim().toLowerCase();
      const matches = ctx.candidates
        .filter((c) => !q || c.full_name.toLowerCase().includes(q))
        .map((c) => ({
          candidate_id: c.id,
          name: c.full_name,
          location: c.location,
          applications: ctx.apps
            .filter(
              (a) =>
                a.candidate_id === c.id &&
                (!job_id || a.job_id === job_id) &&
                (!stage || a.stage === stage),
            )
            .map((a) => ({
              application_id: a.id,
              job: ctx.jobTitle.get(a.job_id),
              stage: a.stage,
              days_in_stage: daysSince(a.stage_changed_at),
              ai_score: ctx.score(c.id, a.job_id),
            })),
        }))
        .filter((c) => (!job_id && !stage) || c.applications.length > 0);
      return {
        result: { total: matches.length, candidates: matches.slice(0, 25) },
      };
    }

    case "get_candidate": {
      const { candidate_id } = parseInput(name, input);
      const { data: cand } = await scope
        .candidates()
        .eq("id", candidate_id)
        .maybeSingle();
      if (!cand) return { result: { error: "Candidate not found" } };
      const [{ data: apps }, { data: jobs }, { data: assessments }] =
        await Promise.all([
          scope.applications().eq("candidate_id", cand.id),
          scope.jobs(),
          scope.latestAssessments().eq("candidate_id", cand.id),
        ]);
      const appIds = (apps ?? []).map((a) => a.id);
      const { data: log } = await scope.supabase
        .from("activity_log")
        .select("action, payload, created_at")
        .eq("organization_id", scope.orgId)
        .in("entity_id", [cand.id, ...appIds])
        .order("created_at", { ascending: false })
        .limit(10);
      const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));
      return {
        result: {
          candidate_id: cand.id,
          name: cand.full_name,
          email: cand.email,
          phone: cand.phone,
          location: cand.location,
          linkedin_url: cand.linkedin_url,
          has_cv: Boolean(cand.cv_path),
          notes: cand.notes,
          applications: (apps ?? []).map((a) => {
            const ai = (assessments ?? []).find((s) => s.job_id === a.job_id);
            return {
              application_id: a.id,
              job: jobTitle.get(a.job_id),
              stage: a.stage,
              days_in_stage: daysSince(a.stage_changed_at),
              ai_assessment: ai
                ? {
                    score: ai.score,
                    summary: ai.summary,
                    strengths: ai.strengths,
                    gaps: ai.gaps,
                  }
                : null,
            };
          }),
          recent_activity: log ?? [],
        },
      };
    }

    case "list_jobs": {
      parseInput(name, input);
      const ctx = await loadContext(scope);
      return {
        result: ctx.jobs.map((j) => ({
          job_id: j.id,
          title: j.title,
          status: j.status,
          location: j.location,
          candidates_per_stage: Object.fromEntries(
            STAGES.map((s) => [
              s,
              ctx.apps.filter((a) => a.job_id === j.id && a.stage === s).length,
            ]),
          ),
        })),
      };
    }

    case "pipeline_summary": {
      const { job_id } = parseInput(name, input);
      const ctx = await loadContext(scope);
      const apps = ctx.apps.filter((a) => !job_id || a.job_id === job_id);
      const scores = apps
        .map((a) => ctx.score(a.candidate_id, a.job_id))
        .filter((s): s is number => s !== null);
      return {
        result: {
          job: job_id ? (ctx.jobTitle.get(job_id) ?? "unknown") : "all jobs",
          per_stage: Object.fromEntries(
            STAGES.map((s) => [s, apps.filter((a) => a.stage === s).length]),
          ),
          assessed: scores.length,
          average_ai_score: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
          stalled: apps
            .filter(
              (a) =>
                ACTIVE_STAGES.includes(a.stage) &&
                daysSince(a.stage_changed_at) > STALLED_DAYS,
            )
            .map((a) => ({
              application_id: a.id,
              candidate: ctx.candidateName.get(a.candidate_id),
              job: ctx.jobTitle.get(a.job_id),
              stage: a.stage,
              days_in_stage: daysSince(a.stage_changed_at),
            })),
        },
      };
    }

    case "move_candidate": {
      const { application_id, stage } = parseInput(name, input);
      const { data: app } = await scope
        .applications()
        .eq("id", application_id)
        .maybeSingle();
      if (!app) return { result: { error: "Application not found" } };
      if (app.stage === stage) return { result: { ok: true, unchanged: true } };

      // Put the card at the bottom of its new column.
      const { data: last } = await scope
        .applications()
        .eq("stage", stage)
        .order("position", { ascending: false })
        .limit(1);
      const position = (last?.[0]?.position ?? 0) + 1;
      const { error } = await scope.updateApplication(app.id, {
        stage,
        position,
      });
      if (error) return { result: { error: "The move failed" } };
      const { data: job } = await scope
        .jobs()
        .eq("id", app.job_id)
        .maybeSingle();
      await scope.log("application", app.id, "moved", {
        from: app.stage,
        to: stage,
        job: job?.title ?? null,
        via: "assistant",
      });
      return {
        result: { ok: true, from: app.stage, to: stage },
        changed: true,
      };
    }
  }
}
