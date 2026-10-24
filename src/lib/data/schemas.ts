import { z } from "zod";

export const JOB_STATUSES = ["open", "paused", "closed"] as const;
export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "internship",
] as const;
export const STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

/**
 * CVs go through a server action, and Vercel caps request bodies at 4.5 MB,
 * so the browser checks this limit before sending.
 */
export const MAX_CV_BYTES = 4 * 1024 * 1024;

export type Stage = (typeof STAGES)[number];

/** Stage order everywhere: by phase, then position within the phase. */
export function compareStages(
  a: { phase: Stage; position: number },
  b: { phase: Stage; position: number },
) {
  return (
    STAGES.indexOf(a.phase) - STAGES.indexOf(b.phase) || a.position - b.position
  );
}

export const jobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(20000).default(""),
  location: z.string().trim().max(200).default(""),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  status: z.enum(JOB_STATUSES),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

export const candidateSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: optionalText(320).pipe(z.email().nullable()),
  phone: optionalText(50),
  location: optionalText(200),
  linkedinUrl: optionalText(500).pipe(
    z
      .string()
      .refine((v) => /^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(v))
      .nullable(),
  ),
  jobIds: z.array(z.uuid()).default([]),
});

/** A move targets either a job's own stage or a phase (its first stage). */
export const moveSchema = z.union([
  z.object({
    applicationId: z.uuid(),
    stageId: z.uuid(),
    position: z.number().finite(),
  }),
  z.object({
    applicationId: z.uuid(),
    stage: z.enum(STAGES),
    position: z.number().finite(),
  }),
]);

export const stageNameSchema = z.string().trim().min(1).max(60);

export const noteSchema = z.object({
  candidateId: z.uuid(),
  notes: z.string().trim().max(20000),
});
