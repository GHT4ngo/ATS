"use client";

import { useTranslations } from "next-intl";
import {
  Ban,
  Clock,
  Flag,
  Hourglass,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small status icons shared by the dashboard, the board and the candidate
 * list. The label shows on hover and is what a screen reader reads.
 */
export type SignalKind =
  | "starred"
  | "flagged"
  | "mismatch"
  | "unassessed"
  | "days"
  | "stuck"
  | "removal";

const SIGNAL: Record<
  SignalKind,
  { icon: LucideIcon; tone: string; filled?: boolean }
> = {
  starred: {
    icon: Star,
    tone: "text-amber-500 dark:text-amber-400",
    filled: true,
  },
  flagged: {
    icon: Flag,
    tone: "text-rose-600 dark:text-rose-400",
    filled: true,
  },
  mismatch: { icon: Ban, tone: "text-rose-600 dark:text-rose-400" },
  unassessed: { icon: Sparkles, tone: "text-violet-600 dark:text-violet-400" },
  days: { icon: Clock, tone: "text-muted-foreground" },
  stuck: { icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
  removal: { icon: Hourglass, tone: "text-rose-600/80 dark:text-rose-400/80" },
};

export function Signal({
  kind,
  days,
  className,
}: {
  kind: SignalKind;
  /** For days, stuck and removal: the number shown next to the icon. */
  days?: number;
  className?: string;
}) {
  const t = useTranslations("Signals");
  const { icon: Icon, tone, filled } = SIGNAL[kind];
  const label = t(kind, { days: days ?? 0 });
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium whitespace-nowrap tabular-nums",
              tone,
              className,
            )}
          />
        }
      >
        <Icon
          className={cn("size-3.5", filled && "fill-current")}
          aria-hidden
        />
        {days !== undefined && <span aria-hidden>{days}</span>}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
