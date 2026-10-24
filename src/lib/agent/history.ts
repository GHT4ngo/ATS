import type Anthropic from "@anthropic-ai/sdk";

type Message = Anthropic.Beta.BetaMessageParam;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export function pendingToolUses(messages: Message[]): ToolUse[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant" || typeof last.content === "string")
    return [];
  return last.content.filter((b): b is ToolUse => b.type === "tool_use");
}

/**
 * Answers tool calls that were never settled (an interrupted request or a cut
 * off turn) so the history stays valid, then adds the user's new text in the
 * same turn.
 */
export function appendUserInput(messages: Message[], input: string) {
  const open = pendingToolUses(messages);
  if (!open.length) {
    messages.push({ role: "user", content: input });
    return;
  }
  messages.push({
    role: "user",
    content: [
      ...open.map((u): ToolResult => ({
        type: "tool_result",
        tool_use_id: u.id,
        is_error: true,
        content: JSON.stringify({
          error: "Not run: the user sent a new message instead.",
        }),
      })),
      { type: "text", text: input },
    ],
  });
}
