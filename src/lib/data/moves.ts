import "server-only";
import { revalidatePath } from "next/cache";
import type { Stage } from "./schemas";
import type { getScope } from "./scope";

type Scope = Awaited<ReturnType<typeof getScope>>;

/**
 * Moves an application, logs a stage change and refreshes the pages that
 * show stage counts. Shared by the kanban drag and the assistant. Without a
 * position the card goes to the bottom of its new column.
 */
export async function moveApplicationTo(
  scope: Scope,
  applicationId: string,
  stage: Stage,
  options: { position?: number; via?: "assistant" } = {},
): Promise<{ ok: true; from: Stage } | { error: "notFound" | "generic" }> {
  const { data: app } = await scope
    .applications()
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "notFound" };

  let position = options.position;
  if (position === undefined) {
    const { data: last } = await scope
      .applications()
      .eq("stage", stage)
      .order("position", { ascending: false })
      .limit(1);
    position = (last?.[0]?.position ?? 0) + 1;
  }

  const { error } = await scope.updateApplication(applicationId, {
    stage,
    position,
  });
  if (error) return { error: "generic" };

  if (app.stage !== stage) {
    const { data: job } = await scope.jobs().eq("id", app.job_id).maybeSingle();
    await scope.log("application", applicationId, "moved", {
      from: app.stage,
      to: stage,
      job: job?.title ?? null,
      ...(options.via ? { via: options.via } : {}),
    });
  }
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { ok: true, from: app.stage };
}
