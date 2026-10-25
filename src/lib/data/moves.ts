import "server-only";
import { revalidatePath } from "next/cache";
import type { Stage } from "./schemas";
import type { getScope } from "./scope";

type Scope = Awaited<ReturnType<typeof getScope>>;

/** Where a card goes: one of the job's own stages, or a phase's first stage. */
export type MoveTarget = { stageId: string } | { phase: Stage };

/**
 * Moves an application, logs a stage change and refreshes the pages that
 * show stage counts. Shared by the kanban drag and the assistant. Without a
 * position the card goes to the bottom of its new column.
 */
export async function moveApplicationTo(
  scope: Scope,
  applicationId: string,
  target: MoveTarget,
  options: { position?: number; via?: "assistant" } = {},
): Promise<
  | {
      ok: true;
      from: Stage;
      to: Stage;
      changed: boolean;
      /** The custom name of the stage the card is now in, if it has one. */
      stageName: string | null;
    }
  | { error: "notFound" | "generic" }
> {
  const { data: app } = await scope
    .applications()
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "notFound" };

  // The job's stages, to resolve the target and name both ends in the log.
  const { data: stages } = await scope.jobStages().eq("job_id", app.job_id);
  // A move by phase into the phase the card is already in (a reorder on the
  // all jobs board) keeps its current stage instead of the phase's first.
  const stage =
    "stageId" in target
      ? stages?.find((s) => s.id === target.stageId)
      : app.stage === target.phase
        ? stages?.find((s) => s.id === app.stage_id)
        : stages?.find((s) => s.phase === target.phase);
  if (!stage) return { error: "notFound" };

  let position = options.position;
  if (position === undefined) {
    const { data: last } = await scope
      .applications()
      .eq("stage_id", stage.id)
      .order("position", { ascending: false })
      .limit(1);
    position = (last?.[0]?.position ?? 0) + 1;
  }

  const { error } = await scope.updateApplication(applicationId, {
    stage_id: stage.id,
    position,
  });
  if (error) return { error: "generic" };

  const changed = app.stage_id !== stage.id;
  if (changed) {
    const fromStage = stages?.find((s) => s.id === app.stage_id);
    const { data: job } = await scope.jobs().eq("id", app.job_id).maybeSingle();
    await scope.log("application", applicationId, "moved", {
      from: app.stage,
      to: stage.phase,
      job: job?.title ?? null,
      ...(fromStage?.name ? { from_stage: fromStage.name } : {}),
      ...(stage.name ? { to_stage: stage.name } : {}),
      ...(options.via ? { via: options.via } : {}),
    });
  }
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  return {
    ok: true,
    from: app.stage,
    to: stage.phase,
    changed,
    stageName: stage.name,
  };
}
