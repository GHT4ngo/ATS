import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { STAGES, compareStages } from "@/lib/data/schemas";
import { moveApplicationTo } from "@/lib/data/moves";
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
  move_candidate: z
    .object({
      application_id: z.uuid(),
      stage_id: z.uuid().optional(),
      stage: z.enum(STAGES).optional(),
    })
    .refine((v) => Boolean(v.stage_id) !== Boolean(v.stage), {
      message: "Give either stage_id or stage, not both",
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
      "All jobs in the organization with status, location, their own pipeline stages (stage_id, name, phase) and the number of candidates per phase.",
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
      "Move one application to another stage. Give stage_id for one of the job's own stages (from list_jobs), or stage for a phase, which picks that phase's first stage. The user is asked to approve the move before it happens; call it only when the user asked for a move.",
    input_schema: {
      type: "object",
      properties: {
        application_id: uuid,
        stage_id: { ...uuid, description: "One of the job's own stages" },
        stage: { ...stage, description: "A phase, when no stage_id is given" },
      },
      required: ["application_id"],
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
  /** Phases, and the custom stage names when the stages have one. */
  from: string;
  to: string;
  fromName: string | null;
  toName: string | null;
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

function stagesOf(scope: Scope) {
  return scope.jobStages();
}

/** Loads what a tool needs; candidates and scores only when asked for. */
async function loadContext(
  scope: Scope,
  need: { candidates?: boolean; scores?: boolean } = {},
) {
  const [{ data: jobs }, { data: apps }, { data: stages }, candidates, scores] =
    await Promise.all([
      scope.jobs(),
      scope.applications(),
      stagesOf(scope),
      need.candidates
        ? scope.candidates().then((r) => r.data ?? [])
        : Promise.resolve([]),
      need.scores
        ? scope.supabase
            .from("latest_cv_assessments")
            .select("candidate_id, job_id, score")
            .eq("organization_id", scope.orgId)
            .then((r) => r.data ?? [])
        : Promise.resolve([]),
    ]);
  const score = new Map(
    scores.map((s) => [`${s.candidate_id}:${s.job_id}`, s.score]),
  );
  const stageName = new Map((stages ?? []).map((st) => [st.id, st.name]));
  return {
    jobs: jobs ?? [],
    stages: stages ?? [],
    /** A custom stage name, or null for a default stage. */
    stageName: (id: string) => stageName.get(id) ?? null,
    jobTitle: new Map((jobs ?? []).map((j) => [j.id, j.title])),
    candidates,
    candidateName: new Map(candidates.map((c) => [c.id, c.full_name])),
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
  const [{ data: cand }, { data: job }, { data: stages }] = await Promise.all([
    scope.candidates().eq("id", app.candidate_id).maybeSingle(),
    scope.jobs().eq("id", app.job_id).maybeSingle(),
    scope.jobStages().eq("job_id", app.job_id),
  ]);
  // Same rule as moveApplicationTo: a phase the candidate is already in
  // keeps their current stage.
  const target = parsed.stage_id
    ? stages?.find((st) => st.id === parsed.stage_id)
    : app.stage === parsed.stage
      ? stages?.find((st) => st.id === app.stage_id)
      : stages?.find((st) => st.phase === parsed.stage);
  if (!target) return null;
  const current = stages?.find((st) => st.id === app.stage_id);
  return {
    toolUseId,
    candidate: cand?.full_name ?? "",
    job: job?.title ?? "",
    from: app.stage,
    to: target.phase,
    fromName: current?.name ?? null,
    toName: target.name ?? null,
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
      const ctx = await loadContext(scope, { candidates: true, scores: true });
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
              stage_name: ctx.stageName(a.stage_id),
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
      const [
        { data: apps },
        { data: jobs },
        { data: assessments },
        { data: stages },
      ] = await Promise.all([
        scope.applications().eq("candidate_id", cand.id),
        scope.jobs(),
        scope.latestAssessments().eq("candidate_id", cand.id),
        stagesOf(scope),
      ]);
      const stageName = new Map((stages ?? []).map((st) => [st.id, st.name]));
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
              stage_name: stageName.get(a.stage_id) ?? null,
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
          candidates_per_phase: Object.fromEntries(
            STAGES.map((s) => [
              s,
              ctx.apps.filter((a) => a.job_id === j.id && a.stage === s).length,
            ]),
          ),
          stages: ctx.stages
            .filter((st) => st.job_id === j.id)
            .sort(compareStages)
            .map((st) => ({
              stage_id: st.id,
              name: st.name,
              phase: st.phase,
              candidates: ctx.apps.filter((a) => a.stage_id === st.id).length,
            })),
        })),
      };
    }

    case "pipeline_summary": {
      const { job_id } = parseInput(name, input);
      const ctx = await loadContext(scope, { candidates: true, scores: true });
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
              stage_name: ctx.stageName(a.stage_id),
              days_in_stage: daysSince(a.stage_changed_at),
            })),
        },
      };
    }

    case "move_candidate": {
      const { application_id, stage_id, stage } = parseInput(name, input);
      const result = await moveApplicationTo(
        scope,
        application_id,
        stage_id ? { stageId: stage_id } : { phase: stage! },
        { via: "assistant" },
      );
      if ("error" in result)
        return {
          result: {
            error:
              result.error === "notFound"
                ? "Application not found"
                : "The move failed",
          },
        };
      return {
        result: { ok: true, from: result.from, to: result.to },
        changed: result.changed,
      };
    }
  }
}
