"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, Briefcase, Flag, Layers, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STAGES } from "@/lib/data/schemas";
import { MARKS, parseMarks, type Mark } from "@/lib/marks";
import { PHASE_STYLE } from "@/lib/phase-style";
import { cn } from "@/lib/utils";

const MARK_STYLE: Record<
  Mark,
  { icon: typeof Star; on: string; filled: boolean }
> = {
  starred: {
    icon: Star,
    on: "bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400",
    filled: true,
  },
  flagged: {
    icon: Flag,
    on: "bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400",
    filled: true,
  },
  mismatch: {
    icon: Ban,
    on: "bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400",
    filled: false,
  },
};

const ICON_BUTTON =
  "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring relative inline-flex size-8 items-center justify-center rounded-md ring-1 ring-transparent transition-colors outline-none ring-inset focus-visible:ring-2";

/**
 * A search field and a row of icon filters: jobs and phase open a menu, marks
 * toggle. They all live in the URL (`q`, `jobs` and `marks` as comma
 * separated lists, `phase`) so a filtered view can be shared. The open
 * candidate (`candidate`) is kept when filters change.
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
  const selectedMarks: Set<string> = parseMarks(
    params.get("marks") ?? undefined,
  );
  const phase = params.get("phase") ?? "";
  const filtered = selected.size > 0 || selectedMarks.size > 0 || phase !== "";

  function clearAll() {
    const next = new URLSearchParams(window.location.search);
    for (const key of ["jobs", "marks", "phase"]) next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // The trigger element goes in render and its content in children, so the
  // tooltip and the menu share one button.
  const tip = (
    label: string,
    trigger: React.ReactElement,
    children: React.ReactNode,
  ) => (
    <Tooltip>
      <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="bg-card/70 ring-foreground/[0.07] elevated flex flex-wrap items-center gap-1 rounded-xl p-1 ring-1 backdrop-blur-sm">
      <label className="relative flex min-w-0 flex-1 items-center sm:w-56 sm:flex-none">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-2.5 size-4"
          aria-hidden
        />
        <input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={q}
          className="placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:ring-2"
          onChange={(e) => {
            setQ(e.target.value);
            clearTimeout(timer.current);
            timer.current = setTimeout(
              () => update("q", e.target.value.trim()),
              250,
            );
          }}
        />
      </label>
      <span className="bg-border mx-1 hidden h-5 w-px sm:block" aria-hidden />

      {jobs && jobs.length > 0 && (
        <DropdownMenu>
          {tip(
            t("jobs"),
            <DropdownMenuTrigger
              aria-label={t("jobs")}
              className={cn(
                ICON_BUTTON,
                selected.size > 0 &&
                  "bg-primary/10 text-primary ring-primary/30",
              )}
            />,
            <>
              <Briefcase className="size-4" />
              {selected.size > 0 && (
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                  {selected.size}
                </span>
              )}
            </>,
          )}
          <DropdownMenuContent align="start" className="w-64">
            {jobs.map((job) => (
              <DropdownMenuCheckboxItem
                key={job.id}
                checked={selected.has(job.id)}
                onCheckedChange={() => toggle("jobs", selected, job.id)}
                closeOnClick={false}
              >
                <span className="truncate">{job.title}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {phases && (
        <DropdownMenu>
          {tip(
            t("phase"),
            <DropdownMenuTrigger
              aria-label={t("phase")}
              className={cn(
                ICON_BUTTON,
                phase &&
                  cn(
                    PHASE_STYLE[phase as keyof typeof PHASE_STYLE]?.soft,
                    "ring-1",
                  ),
              )}
            />,
            <Layers className="size-4" />,
          )}
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup
              value={phase}
              onValueChange={(v) => update("phase", v === phase ? "" : v)}
            >
              {STAGES.map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  <span
                    className={cn("size-2 rounded-full", PHASE_STYLE[p].dot)}
                    aria-hidden
                  />
                  {st(p)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {marks &&
        MARKS.map((mark) => {
          const on = selectedMarks.has(mark);
          const { icon: Icon, on: onStyle, filled } = MARK_STYLE[mark];
          return (
            <span key={mark}>
              {tip(
                m(`filter.${mark}`),
                <button
                  type="button"
                  aria-label={m(`filter.${mark}`)}
                  aria-pressed={on}
                  className={cn(ICON_BUTTON, on && onStyle)}
                  onClick={() => toggle("marks", selectedMarks, mark)}
                />,
                <Icon
                  className={cn("size-4", on && filled && "fill-current")}
                />,
              )}
            </span>
          );
        })}

      {filtered && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={clearAll}
        >
          <X className="size-3.5" />
          {t("clear")}
        </Button>
      )}
    </div>
  );
}
