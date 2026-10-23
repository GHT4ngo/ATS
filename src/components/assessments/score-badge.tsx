import { cn } from "@/lib/utils";

/** Colour bands follow the scoring rubric in the assessment prompt. */
export function scoreTone(score: number) {
  if (score >= 70)
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  if (score >= 50)
    return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
  return "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200";
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
