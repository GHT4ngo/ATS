"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUp, Check, RotateCcw, Sparkles, X } from "lucide-react";
import type Anthropic from "@anthropic-ai/sdk";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = Anthropic.Beta.BetaMessageParam;
type Pending = {
  toolUseId: string;
  candidate: string;
  job: string;
  from: string;
  to: string;
};
type Event =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "pending"; actions: Pending[] }
  | { type: "changed" }
  | { type: "done"; messages: Message[] }
  | { type: "error"; code: string };

type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string };

/** What the chat shows, derived from the API history. */
function entries(messages: Message[]): Entry[] {
  return messages.flatMap((m): Entry[] => {
    const content = m.content ?? "";
    if (typeof content === "string")
      return content
        ? [{ kind: m.role === "user" ? "user" : "assistant", text: content }]
        : [];
    if (m.role !== "assistant") return [];
    return content.flatMap((b): Entry[] => {
      if (b.type === "text" && b.text)
        return [{ kind: "assistant", text: b.text }];
      if (b.type === "tool_use") return [{ kind: "tool", name: b.name }];
      return [];
    });
  });
}

export function AgentPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Agent");
  const s = useTranslations("Stages");
  const e = useTranslations("Errors");
  const router = useRouter();
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [liveTool, setLiveTool] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [decisions, setDecisions] = useState<
    Record<string, "approve" | "decline">
  >({});
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The user's text while its request runs; history only changes when the
  // server returns the confirmed conversation.
  const [sending, setSending] = useState<string | null>(null);

  // Leaving the app (sign out, org switch) cancels a running request.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [history, live, pending, liveTool]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // Only when focus is in the panel, so Escape in other dialogs is theirs.
    const onKey = (ev: KeyboardEvent) => {
      if (
        ev.key === "Escape" &&
        panelRef.current?.contains(document.activeElement)
      )
        onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(body: {
    input?: string;
    decisions?: Record<string, string>;
  }) {
    setBusy(true);
    setError(null);
    setPending([]);
    setLive("");
    setSending(body.input ?? null);
    const controller = new AbortController();
    abortRef.current = controller;
    let confirmed = false;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, ...body }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error === "conversationTooLong" ? data.error : "agentFailed",
        );
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as Event;
          if (event.type === "text") {
            setLiveTool(null);
            setLive((l) => l + event.delta);
          } else if (event.type === "tool") setLiveTool(event.name);
          else if (event.type === "pending") setPending(event.actions);
          else if (event.type === "changed") router.refresh();
          else if (event.type === "error") setError(event.code);
          else if (event.type === "done") {
            confirmed = true;
            setHistory(event.messages);
            setLive("");
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) setError("agentFailed");
    } finally {
      // Nothing confirmed: give the text back so it can be sent again.
      if (!confirmed && body.input) setInput(body.input);
      setSending(null);
      setBusy(false);
      setLiveTool(null);
      setDecisions({});
      inputRef.current?.focus();
    }
  }

  function submit() {
    const text = input.trim();
    if (!text || busy || pending.length) return;
    setInput("");
    send({ input: text });
  }

  function decide(id: string, choice: "approve" | "decline") {
    const next = { ...decisions, [id]: choice };
    setDecisions(next);
    if (pending.every((p) => next[p.toolUseId])) send({ decisions: next });
  }

  const shown = entries(history);
  const suggestions = [
    t("suggestSummary"),
    t("suggestStalled"),
    t("suggestEmail"),
  ];

  return (
    <aside
      ref={panelRef}
      aria-label={t("title")}
      hidden={!open}
      className="bg-background fixed inset-0 z-40 flex flex-col md:sticky md:top-0 md:z-auto md:h-screen md:w-96 md:shrink-0 md:border-l"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4" />
        <h2 className="flex-1 font-semibold">{t("title")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("newChat")}
          title={t("newChat")}
          disabled={busy || (!history.length && !error)}
          onClick={() => {
            setHistory([]);
            setPending([]);
            setError(null);
          }}
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("close")}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {!shown.length && !busy && (
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">{t("intro")}</p>
            <div className="grid gap-2">
              {suggestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="h-auto justify-start py-1.5 text-left whitespace-normal"
                  onClick={() => send({ input: q })}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 text-sm">
          {shown.map((entry, i) =>
            entry.kind === "tool" ? (
              <p key={i} className="text-muted-foreground text-xs">
                {t(`tools.${entry.name}`)}
              </p>
            ) : (
              <p
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 whitespace-pre-wrap",
                  entry.kind === "user"
                    ? "bg-primary text-primary-foreground ml-8"
                    : "bg-muted mr-4",
                )}
              >
                {entry.text}
              </p>
            ),
          )}
          {sending && (
            <p className="bg-primary text-primary-foreground ml-8 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {sending}
            </p>
          )}
          {liveTool && (
            <p className="text-muted-foreground text-xs">
              {t(`tools.${liveTool}`)}
            </p>
          )}
          {live && (
            <p className="bg-muted mr-4 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {live}
            </p>
          )}
          {busy && !live && !liveTool && (
            <p className="text-muted-foreground text-xs">{t("thinking")}</p>
          )}

          {pending.map((p) => (
            <div
              key={p.toolUseId}
              className="grid gap-2 rounded-lg border p-3"
              role="group"
              aria-label={t("approveTitle")}
            >
              <p className="font-medium">{t("approveTitle")}</p>
              <p>
                {t("moveQuestion", {
                  candidate: p.candidate,
                  job: p.job,
                  from: s(p.from),
                  to: s(p.to),
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !!decisions[p.toolUseId]}
                  onClick={() => decide(p.toolUseId, "approve")}
                >
                  <Check className="size-4" />
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !!decisions[p.toolUseId]}
                  onClick={() => decide(p.toolUseId, "decline")}
                >
                  {t("decline")}
                </Button>
              </div>
            </div>
          ))}
          {error && (
            <div role="alert" className="grid justify-items-start gap-2">
              <p className="text-destructive text-sm">{e(error)}</p>
              {error === "conversationTooLong" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setHistory([]);
                    setPending([]);
                    setError(null);
                  }}
                >
                  {t("newChat")}
                </Button>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className="grid gap-2 border-t p-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            aria-label={t("inputLabel")}
            placeholder={t("placeholder")}
            value={input}
            rows={2}
            maxLength={2000}
            disabled={busy || pending.length > 0}
            onChange={(ev) => setInput(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                submit();
              }
            }}
            className="border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("send")}
            disabled={busy || !input.trim() || pending.length > 0}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">{t("disclaimer")}</p>
      </form>
    </aside>
  );
}
