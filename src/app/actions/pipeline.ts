"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

const markSchema = z.discriminatedUnion("mark", [
  z.object({
    applicationId: z.uuid(),
    mark: z.enum(["starred", "flagged"]),
    value: z.boolean(),
  }),
  // null hands the verdict back to the AI score.
  z.object({
    applicationId: z.uuid(),
    mark: z.literal("mismatch"),
    value: z.boolean().nullable(),
  }),
]);

export async function markApplication(
  input: z.input<typeof markSchema>,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };
  const { applicationId, mark, value } = parsed.data;

  const { data, error } = await scope
    .updateApplication(applicationId, { [mark]: value })
    .select("id");
  if (error || !data?.length) return { error: "generic" };
  revalidatePath("/pipeline");
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  return { ok: true };
}

const archiveSchema = z.object({
  applicationId: z.uuid(),
  archived: z.boolean(),
});

/**
 * Clears a hired or rejected card off the board, or brings it back (the undo
 * in the toast). The application stays, so hires still count.
 */
export async function archiveApplication(
  input: z.input<typeof archiveSchema>,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidInput" };
  const { applicationId, archived } = parsed.data;

  const { data, error } = await scope
    .updateApplication(applicationId, {
      archived_at: archived ? new Date().toISOString() : null,
    })
    .in("stage", ["hired", "rejected"])
    .select("job_id");
  if (error || !data?.length) return { error: "generic" };
  const { data: job } = await scope
    .jobs()
    .eq("id", data[0].job_id)
    .maybeSingle();
  await scope.log(
    "application",
    applicationId,
    archived ? "archived" : "restored",
    { job: job?.title ?? null },
  );
  revalidatePath("/pipeline");
  return { ok: true };
}
