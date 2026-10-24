"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flag, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAGES } from "@/lib/data/schemas";
import { MARKS, type Mark } from "@/lib/marks";
import { PHASE_STYLE } from "@/lib/phase-style";
import { cn } from "@/lib/utils";

const MARK_STYLE: Record<Mark, { icon: typeof Star; on: string }> = {
  starred: {
    icon: Star,
    on: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  flagged: {
    icon: Flag,
    on: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
  mismatch: {
    icon: X,
    on: "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
};

/**
 * Name search plus optional filters on jobs, marks and phase. They all live
 * in the URL (`q`, `jobs` and `marks` as comma separated lists, `phase`) so a
 * filtered view can be shared. The open candidate (`candidate`) is kept when
 * filters change.
 */
export function FilterBar({
  jobs,
  marks,
  phases,
}: {
  jobs?: { id: string; title: string }[];
  marks?: boolean;
  phases?: boolean;
}) {
  const t = useTranslations("Filters");
  const m = useTranslations("Marks");
  const st = useTranslations("Stages");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const selected = new Set(
    (params.get("jobs") ?? "").split(",").filter(Boolean),
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(key: string, current: Set<string>, id: string) {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    update(key, [...next].join(","));
  }
  const selectedMarks = new Set(
    (params.get("marks") ?? "").split(",").filter(Boolean),
  );
  const phase = params.get("phase") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        aria-label={t("search")}
        placeholder={t("search")}
        value={q}
        className="w-full sm:w-56"
        onChange={(e) => {
          setQ(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(
            () => update("q", e.target.value.trim()),
            250,
          );
        }}
      />
      {jobs && jobs.length > 0 && (
        <div
          role="group"
          aria-label={t("jobs")}
          className="flex flex-wrap items-center gap-1.5"
        >
          {jobs.map((job) => {
            const on = selected.has(job.id);
            return (
              <Button
                key={job.id}
                type="button"
                size="sm"
                variant={on ? "default" : "outline"}
                aria-pressed={on}
                className={cn("max-w-48 truncate")}
                onClick={() => toggle("jobs", selected, job.id)}
              >
                {job.title}
              </Button>
            );
          })}
          {selected.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => update("jobs", "")}
            >
              {t("clear")}
            </Button>
          )}
        </div>
      )}
      {marks && (
        <div
          role="group"
          aria-label={t("marks")}
          className="flex flex-wrap items-center gap-1.5"
        >
          {MARKS.map((mark) => {
            const on = selectedMarks.has(mark);
            const { icon: Icon, on: onStyle } = MARK_STYLE[mark];
            return (
              <Button
                key={mark}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={on}
                className={cn(on && onStyle)}
                onClick={() => toggle("marks", selectedMarks, mark)}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    on && mark !== "mismatch" && "fill-current",
                  )}
                />
                {m(`filter.${mark}`)}
              </Button>
            );
          })}
        </div>
      )}
      {phases && (
        <div
          role="group"
          aria-label={t("phase")}
          className="flex flex-wrap items-center gap-1.5"
        >
          {STAGES.map((p) => {
            const on = phase === p;
            return (
              <Button
                key={p}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={on}
                className={cn(
                  on && PHASE_STYLE[p].soft,
                  on && "border-transparent",
                )}
                onClick={() => update("phase", on ? "" : p)}
              >
                <span
                  className={cn("size-2 rounded-full", PHASE_STYLE[p].dot)}
                  aria-hidden
                />
                {st(p)}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
