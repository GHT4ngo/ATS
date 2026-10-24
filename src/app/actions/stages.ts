"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/auth/schemas";
import { STAGES, stageNameSchema } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";

// The database enforces the rules (a stage keeps its phase, the last stage of
// a phase and stages in use cannot be deleted); these actions check first so
// the user gets a clear message.

type Scope = Awaited<ReturnType<typeof getScope>>;

async function stagesOfJob(scope: Scope, jobId: string) {
  const { data } = await scope.jobStages().eq("job_id", jobId);
  return data ?? [];
}

function refresh() {
  revalidatePath("/jobs");
  revalidatePath("/pipeline");
}

export async function addStage(input: {
  jobId: string;
  phase: string;
  name: string;
}): Promise<ActionState> {
  const parsed = z
    .object({ jobId: z.uuid(), phase: z.enum(STAGES), name: stageNameSchema })
    .safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };
  const { jobId, phase, name } = parsed.data;

  const scope = await getScope();
  const stages = await stagesOfJob(scope, jobId);
  const { data: job } = await scope.jobs().eq("id", jobId).maybeSingle();
  if (!job) return { error: "generic" };
  const last = stages.filter((s) => s.phase === phase).at(-1);
  const { error } = await scope.supabase.from("job_stages").insert({
    organization_id: scope.orgId,
    job_id: jobId,
    phase,
    name,
    position: (last?.position ?? 0) + 1,
  });
  if (error) return { error: "generic" };
  refresh();
  return { ok: true };
}

/** An empty name turns the stage back into the phase's default name. */
export async function renameStage(input: {
  stageId: string;
  name: string;
}): Promise<ActionState> {
  const parsed = z
    .object({
      stageId: z.uuid(),
      name: z.union([z.string().trim().length(0), stageNameSchema]),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };

  const scope = await getScope();
  const { data, error } = await scope.supabase
    .from("job_stages")
    .update({ name: parsed.data.name || null })
    .eq("organization_id", scope.orgId)
    .eq("id", parsed.data.stageId)
    .select("id");
  if (error || !data?.length) return { error: "generic" };
  refresh();
  return { ok: true };
}

/** Moves a stage one step up or down among the stages of its phase. */
export async function reorderStage(input: {
  stageId: string;
  direction: "up" | "down";
}): Promise<ActionState> {
  const parsed = z
    .object({ stageId: z.uuid(), direction: z.enum(["up", "down"]) })
    .safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };

  const scope = await getScope();
  const { data: stage } = await scope
    .jobStages()
    .eq("id", parsed.data.stageId)
    .maybeSingle();
  if (!stage) return { error: "generic" };
  // One statement in the database, so quick clicks cannot tie positions.
  const { error } = await scope.supabase.rpc("reorder_job_stage", {
    p_stage: stage.id,
    p_direction: parsed.data.direction,
  });
  if (error) return { error: "generic" };
  refresh();
  return { ok: true };
}

export async function deleteStage(stageId: string): Promise<ActionState> {
  const id = z.uuid().safeParse(stageId);
  if (!id.success) return { error: "invalidInput" };

  const scope = await getScope();
  const { data: stage } = await scope
    .jobStages()
    .eq("id", id.data)
    .maybeSingle();
  if (!stage) return { error: "generic" };

  const stages = await stagesOfJob(scope, stage.job_id);
  if (stages.filter((s) => s.phase === stage.phase).length < 2)
    return { error: "stageLast" };
  const { count } = await scope.supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", scope.orgId)
    .eq("stage_id", stage.id);
  if (count) return { error: "stageInUse" };

  const { error } = await scope.supabase
    .from("job_stages")
    .delete()
    .eq("organization_id", scope.orgId)
    .eq("id", stage.id);
  if (error)
    return { error: error.code === "23503" ? "stageInUse" : "generic" };
  refresh();
  return { ok: true };
}
