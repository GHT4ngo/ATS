"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addStage,
  deleteStage,
  renameStage,
  reorderStage,
} from "@/app/actions/stages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/auth/schemas";
import { STAGES, type Stage } from "@/lib/data/schemas";

export type StageRow = {
  id: string;
  name: string | null;
  phase: Stage;
  candidates: number;
};

export function JobStagesDialog({
  jobId,
  jobTitle,
  stages,
}: {
  jobId: string;
  jobTitle: string;
  /** Sorted by phase, then position. */
  stages: StageRow[];
}) {
  const t = useTranslations("JobStages");
  const s = useTranslations("Stages");
  const e = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<Stage | null>(null);
  const [newName, setNewName] = useState("");
  // Bumped when a rename fails, so the uncontrolled name fields reset to the
  // names the server still has.
  const [resetKey, setResetKey] = useState(0);

  function run(action: () => Promise<ActionState>, done?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(e(result.error));
        setResetKey((k) => k + 1);
      } else done?.();
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {t("open")}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { job: jobTitle })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4" aria-busy={pending}>
          {STAGES.map((phase) => {
            const inPhase = stages.filter((st) => st.phase === phase);
            return (
              <section key={phase} className="grid gap-2">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">
                  {s(phase)}
                </h3>
                <ul className="grid gap-2">
                  {inPhase.map((st, i) => {
                    const blocked =
                      inPhase.length < 2
                        ? t("lastInPhase")
                        : st.candidates
                          ? t("inUse", { count: st.candidates })
                          : null;
                    return (
                      <li key={st.id} className="flex items-center gap-1">
                        <Input
                          key={`${st.id}:${st.name ?? ""}:${resetKey}`}
                          aria-label={t("nameLabel", { phase: s(phase) })}
                          defaultValue={st.name ?? ""}
                          placeholder={s(phase)}
                          maxLength={60}
                          disabled={pending}
                          className="h-8 flex-1"
                          onBlur={(ev) => {
                            const name = ev.target.value.trim();
                            if (name !== (st.name ?? ""))
                              run(() => renameStage({ stageId: st.id, name }));
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") ev.currentTarget.blur();
                          }}
                        />
                        <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
                          {st.candidates}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("moveUp")}
                          disabled={pending || i === 0}
                          onClick={() =>
                            run(() =>
                              reorderStage({ stageId: st.id, direction: "up" }),
                            )
                          }
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("moveDown")}
                          disabled={pending || i === inPhase.length - 1}
                          onClick={() =>
                            run(() =>
                              reorderStage({
                                stageId: st.id,
                                direction: "down",
                              }),
                            )
                          }
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("delete")}
                          title={blocked ?? t("delete")}
                          disabled={pending || Boolean(blocked)}
                          onClick={() => run(() => deleteStage(st.id))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                {adding === phase ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      run(
                        () => addStage({ jobId, phase, name: newName }),
                        () => {
                          setAdding(null);
                          setNewName("");
                        },
                      );
                    }}
                  >
                    <Input
                      autoFocus
                      aria-label={t("newName", { phase: s(phase) })}
                      value={newName}
                      maxLength={60}
                      required
                      onChange={(ev) => setNewName(ev.target.value)}
                      className="h-8 flex-1"
                    />
                    <Button type="submit" size="sm" disabled={pending}>
                      {t("add")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAdding(null)}
                    >
                      {t("cancel")}
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-self-start"
                    onClick={() => {
                      setAdding(phase);
                      setNewName("");
                    }}
                  >
                    <Plus className="size-4" />
                    {t("addTo", { phase: s(phase) })}
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
