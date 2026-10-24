import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { appendUserInput, pendingToolUses } from "./history";

type Message = Anthropic.Beta.BetaMessageParam;

const toolTurn: Message = {
  role: "assistant",
  content: [
    { type: "text", text: "Checking" },
    { type: "tool_use", id: "toolu_1", name: "list_jobs", input: {} },
  ],
};

describe("appendUserInput", () => {
  it("adds plain text after a finished turn", () => {
    const messages: Message[] = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: [{ type: "text", text: "Hello" }] },
    ];
    appendUserInput(messages, "Next");
    expect(messages.at(-1)).toEqual({ role: "user", content: "Next" });
  });

  it("closes unanswered tool calls before the new text", () => {
    const messages: Message[] = [{ role: "user", content: "Hi" }, toolTurn];
    appendUserInput(messages, "Never mind");
    const last = messages.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content).toEqual([
      expect.objectContaining({
        type: "tool_result",
        tool_use_id: "toolu_1",
        is_error: true,
      }),
      { type: "text", text: "Never mind" },
    ]);
    expect(pendingToolUses(messages)).toEqual([]);
  });
});
