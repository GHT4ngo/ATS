"use server";

import { revalidatePath } from "next/cache";
import { moveSchema } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";
import type { ActionState } from "@/lib/auth/schemas";

export async function moveApplication(input: {
  applicationId: string;
  stage: string;
  position: number;
}): Promise<ActionState> {
  const scope = await getScope();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };
  const { applicationId, stage, position } = parsed.data;

  const { data: app } = await scope
    .applications()
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "generic" };

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
    });
  }
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { ok: true };
}
