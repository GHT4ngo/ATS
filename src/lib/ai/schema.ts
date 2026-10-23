import { z } from "zod";

export const assessmentSchema = z.object({
  score: z.int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  skillMatches: z.array(
    z.object({
      skill: z.string(),
      match: z.enum(["strong", "partial", "missing"]),
      evidence: z.string(),
    }),
  ),
  interviewQuestions: z.array(z.string()),
});

export type Assessment = z.infer<typeof assessmentSchema>;
