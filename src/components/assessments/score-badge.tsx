import { cn } from "@/lib/utils";

/** Colour bands follow the scoring rubric in the assessment prompt. */
export function scoreTone(score: number) {
  if (score >= 70)
    return "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-300";
  if (score >= 50)
    return "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25 ring-inset dark:text-amber-300";
  return "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/25 ring-inset dark:text-rose-300";
}

export function ScoreBadge({
  score,
  label,
  className,
}: {
  score: number;
  label: string;
  className?: string;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-5 items-center rounded-4xl px-2 text-xs font-semibold tabular-nums",
        scoreTone(score),
        className,
      )}
    >
      {score}
    </span>
  );
}
