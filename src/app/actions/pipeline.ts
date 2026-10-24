"use server";

import { moveSchema } from "@/lib/data/schemas";
import { moveApplicationTo } from "@/lib/data/moves";
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

  const result = await moveApplicationTo(scope, applicationId, stage, {
    position,
  });
  return "error" in result ? { error: "generic" } : { ok: true };
}
