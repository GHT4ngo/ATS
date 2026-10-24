"use server";

import { moveSchema } from "@/lib/data/schemas";
import { moveApplicationTo } from "@/lib/data/moves";
import { getScope } from "@/lib/data/scope";
import type { ActionState } from "@/lib/auth/schemas";

export async function moveApplication(
  input:
    | { applicationId: string; stageId: string; position: number }
    | { applicationId: string; stage: string; position: number },
): Promise<ActionState & { stageName?: string | null }> {
  const scope = await getScope();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };
  const { applicationId, position } = parsed.data;
  const target =
    "stageId" in parsed.data
      ? { stageId: parsed.data.stageId }
      : { phase: parsed.data.stage };

  const result = await moveApplicationTo(scope, applicationId, target, {
    position,
  });
  return "error" in result
    ? { error: "generic" }
    : { ok: true, stageName: result.stageName };
}
