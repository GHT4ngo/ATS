"use server";

import { revalidatePath } from "next/cache";
import { jobSchema } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";
import type { ActionState } from "@/lib/auth/schemas";
import { z } from "zod";

function parse(formData: FormData) {
  return jobSchema.safeParse(Object.fromEntries(formData));
}

export async function createJob(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const scope = await getScope();
  const parsed = parse(formData);
  if (!parsed.success) return { error: "invalidInput" };
  const { employmentType, ...rest } = parsed.data;

  const { data, error } = await scope.supabase
    .from("jobs")
    .insert({
      ...rest,
      employment_type: employmentType,
      organization_id: scope.orgId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "generic" };

  await scope.log("job", data.id, "created", { title: rest.title });
  revalidatePath("/jobs");
  return { ok: true };
}

export async function updateJob(
  jobId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const scope = await getScope();
  const id = z.uuid().safeParse(jobId);
  const parsed = parse(formData);
  if (!id.success || !parsed.success) return { error: "invalidInput" };
  const { employmentType, ...rest } = parsed.data;

  const { error } = await scope.updateJob(id.data, {
    ...rest,
    employment_type: employmentType,
  });
  if (error) return { error: "generic" };

  await scope.log("job", id.data, "updated", { title: rest.title });
  revalidatePath("/jobs");
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function setJobStatus(jobId: string, status: string) {
  const scope = await getScope();
  const parsed = jobSchema.shape.status.safeParse(status);
  const id = z.uuid().safeParse(jobId);
  if (!parsed.success || !id.success) return;

  const { error } = await scope.updateJob(id.data, { status: parsed.data });
  if (!error)
    await scope.log("job", id.data, "status", { status: parsed.data });
  revalidatePath("/jobs");
}
