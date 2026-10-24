import "server-only";
import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { getScope } from "@/lib/data/scope";

type Scope = Awaited<ReturnType<typeof getScope>>;
type Message = Anthropic.Beta.BetaMessageParam;
type Turn = Pick<Anthropic.Beta.BetaMessage, "content" | "stop_reason">;

/**
 * A scripted stand in for the model, used with AI_FAKE=1 in e2e tests. It
 * runs the real loop and tools: a question calls pipeline_summary, a message
 * with "flytta" or "move" proposes moving the first applied candidate on.
 */
export async function fakeTurn(
  scope: Scope,
  messages: Message[],
  emit: (e: { type: "text"; delta: string }) => void,
): Promise<Turn> {
  const content = messages.at(-1)?.content ?? "";
  const text = (t: string): Turn => {
    emit({ type: "text", delta: t });
    return {
      stop_reason: "end_turn",
      content: [{ type: "text", text: t, citations: null }],
    } as Turn;
  };
  const tool = (name: string, input: Record<string, unknown>): Turn =>
    ({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: `toolu_${randomUUID()}`, name, input }],
    }) as unknown as Turn;

  if (typeof content !== "string") {
    const result = content.find((b) => b.type === "tool_result");
    const body = result && "content" in result ? String(result.content) : "";
    if (body.includes("declined")) return text("Okej, jag flyttar inte.");
    if (body.includes('"ok":true'))
      return text("Klart, kandidaten är flyttad.");
    const summary = JSON.parse(body || "{}");
    return text(`Ansökt: ${summary.per_stage?.applied ?? 0}.`);
  }

  if (/flytta|move/i.test(content)) {
    const { data } = await scope
      .applications()
      .eq("stage", "applied")
      .order("position")
      .limit(1);
    if (!data?.length) return text("Ingen kandidat att flytta.");
    return tool("move_candidate", {
      application_id: data[0].id,
      stage: "screening",
    });
  }
  return tool("pipeline_summary", {});
}
