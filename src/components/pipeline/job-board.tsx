"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const FOLD_KEY = "ats.board.jobs";

/**
 * A job's section on the pipeline page: a header with the hiring progress,
 * which folds the board away. Filled and closed jobs start folded; the choice
 * is remembered in this browser.
 */
export function JobBoard({
  jobId,
  title,
  meta,
  cards,
  hired,
  openings,
  foldedByDefault,
  children,
}: {
  jobId: string;
  title: string;
  meta: string;
  cards: number;
  hired: number;
  openings: number;
  foldedByDefault: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Pipeline");
  const [folded, setFolded] = useState(foldedByDefault);
  const filled = hired >= openings;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}");
      if (typeof saved[jobId] === "boolean") setFolded(saved[jobId]);
    } catch {
      // No storage: the default stands.
    }
  }, [jobId]);

  function toggle() {
    const next = !folded;
    setFolded(next);
    try {
      const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}");
      localStorage.setItem(
        FOLD_KEY,
        JSON.stringify({ ...saved, [jobId]: next }),
      );
    } catch {
      // Not remembered, which is fine.
    }
  }

  const bodyId = `job-board-${jobId}`;
  return (
    <section
      aria-label={title}
      className="bg-card/60 ring-foreground/[0.07] elevated rounded-2xl ring-1 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-expanded={!folded}
        aria-controls={bodyId}
        onClick={toggle}
        className="hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-2"
      >
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            folded && "-rotate-90",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          {meta && (
            <span className="text-muted-foreground block truncate text-xs">
              {meta}
            </span>
          )}
        </span>
        <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
          {t("cardCount", { count: cards })}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset",
            filled
              ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
              : "bg-muted text-muted-foreground ring-foreground/5",
          )}
          title={t("hiredOf", { hired, openings })}
        >
          {filled && <CircleCheck className="size-3.5" />}
          {t("hiredOf", { hired, openings })}
        </span>
      </button>
      {!folded && (
        <div id={bodyId} className="px-2 pb-2">
          {children}
        </div>
      )}
    </section>
  );
}
