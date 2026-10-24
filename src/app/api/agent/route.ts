import { getLocale } from "next-intl/server";
import { z } from "zod";
import { appendUserInput } from "@/lib/agent/history";
import { runAgent, type AgentEvent } from "@/lib/agent/run";
import { getActiveOrganization } from "@/lib/auth/session";
import { getOptionalScope } from "@/lib/data/scope";

export const maxDuration = 300;

// Well under Vercel's 4.5 MB request limit. History is never trimmed: editing
// earlier turns would invalidate the model's thinking blocks, so a long
// conversation ends with a prompt to start a new one.
const MAX_BODY_BYTES = 2_000_000;
const MAX_MESSAGES = 200;

// The browser keeps the conversation and sends it back each turn. Assistant
// turns are echoed as the API returned them (thinking blocks included); user
// turns may only carry text and tool results.
const block = z.looseObject({ type: z.string() });
const userBlock = z.looseObject({ type: z.enum(["text", "tool_result"]) });
const bodySchema = z.object({
  messages: z
    .array(
      z.discriminatedUnion("role", [
        z.object({
          role: z.literal("user"),
          content: z.union([z.string().max(4000), z.array(userBlock).max(20)]),
        }),
        z.object({
          role: z.literal("assistant"),
          content: z.union([z.string(), z.array(block).max(50)]),
        }),
      ]),
    )
    .max(MAX_MESSAGES),
  input: z.string().trim().min(1).max(2000).optional(),
  decisions: z
    .record(z.string().max(100), z.enum(["approve", "decline"]))
    .optional(),
});

export async function POST(request: Request) {
  // JSON only: a cross site form post cannot set this content type.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response(null, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return Response.json({ error: "conversationTooLong" }, { status: 413 });

  const scope = await getOptionalScope();
  const org = await getActiveOrganization();
  if (!scope || !org)
    return Response.json({ error: "noOrganization" }, { status: 400 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES)
    return Response.json({ error: "conversationTooLong" }, { status: 413 });
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some(
      (i) =>
        i.code === "too_big" && i.path.length === 1 && i.path[0] === "messages",
    );
    return Response.json(
      { error: tooLong ? "conversationTooLong" : "invalidInput" },
      { status: tooLong ? 413 : 400 },
    );
  }

  const { input, decisions = {} } = parsed.data;
  const messages = parsed.data.messages as Parameters<
    typeof runAgent
  >[0]["messages"];
  if (input) appendUserInput(messages, input);
  if (!messages.length || messages[0].role !== "user")
    return Response.json({ error: "invalidInput" }, { status: 400 });

  const locale = (await getLocale()) === "en" ? "en" : "sv";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // The client may disconnect at any point; writing to a cancelled
      // stream throws, and request.signal then stops the run.
      const emit = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {}
      };
      await runAgent({
        scope,
        orgName: org.name,
        locale,
        messages,
        decisions,
        emit,
        signal: request.signal,
      });
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
