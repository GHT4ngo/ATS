import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { extractText, getDocumentProxy } from "unpdf";
import prompt from "./assessment-prompt.json";
import { buildUserPrompt } from "./prompt";
import { assessmentSchema, type Assessment } from "./schema";

export const ASSESSMENT_MODEL = "claude-sonnet-5-5";
/** About 12 000 tokens; a CV longer than this is almost certainly not a CV. */
export const MAX_CV_CHARS = 50_000;

export type AssessmentErrorCode =
  | "cvNoText"
  | "cvTooLong"
  | "cvUnreadable"
  | "aiUnavailable"
  | "aiRefused"
  | "aiFailed";

export class AssessmentError extends Error {
  constructor(public code: AssessmentErrorCode) {
    super(code);
  }
}

export async function pdfToText(pdf: ArrayBuffer): Promise<string> {
  let doc;
  try {
    doc = await getDocumentProxy(new Uint8Array(pdf));
  } catch {
    // Corrupt or password protected: retrying will not help.
    throw new AssessmentError("cvUnreadable");
  }
  try {
    const { text } = await extractText(doc, { mergePages: true });
    const clean = text
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (clean.length < 50) throw new AssessmentError("cvNoText");
    if (clean.length > MAX_CV_CHARS) throw new AssessmentError("cvTooLong");
    return clean;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** A fixed result for e2e tests and local work without an API key. */
function fakeAssessment(): Assessment {
  return {
    score: 72,
    summary: "Test assessment.",
    strengths: ["Relevant experience"],
    gaps: ["Unclear testing experience"],
    skillMatches: [{ skill: "TypeScript", match: "strong", evidence: "CV" }],
    interviewQuestions: ["How do you test your code?"],
  };
}

export async function assessCv(input: {
  language: "sv" | "en";
  title: string;
  description: string;
  cv: string;
}): Promise<{ result: Assessment; model: string }> {
  if (process.env.AI_FAKE === "1" && process.env.NODE_ENV !== "production") {
    return { result: fakeAssessment(), model: "fake" };
  }
  if (!process.env.ANTHROPIC_API_KEY)
    throw new AssessmentError("aiUnavailable");

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: ASSESSMENT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(assessmentSchema),
      },
      system: prompt.system,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("CV assessment API error", error.status, error.message);
    } else {
      console.error("CV assessment failed", error);
    }
    throw new AssessmentError("aiFailed");
  }

  if (response.stop_reason === "refusal")
    throw new AssessmentError("aiRefused");
  const result = response.parsed_output;
  if (response.stop_reason !== "end_turn" || !result) {
    console.error("CV assessment unusable", response.stop_reason);
    throw new AssessmentError("aiFailed");
  }
  return { result, model: response.model };
}
