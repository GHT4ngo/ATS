import type { Stage } from "@/lib/data/schemas";

/**
 * One colour per phase, used on every page so a phase looks the same on the
 * board, the job list, the candidate list and the dashboard. Full class names,
 * so Tailwind keeps them.
 */
export const PHASE_STYLE: Record<
  Stage,
  {
    /** A small solid marker: dots, bars, column strips. */
    dot: string;
    /** A tinted badge with readable text in both themes. */
    soft: string;
    /** The coloured left edge of a card. */
    edge: string;
    /** A faint column background. */
    wash: string;
  }
> = {
  applied: {
    dot: "bg-blue-500",
    soft: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
    edge: "border-l-blue-500",
    wash: "bg-blue-50/70 dark:bg-blue-950/25",
  },
  screening: {
    dot: "bg-violet-500",
    soft: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
    edge: "border-l-violet-500",
    wash: "bg-violet-50/70 dark:bg-violet-950/25",
  },
  interview: {
    dot: "bg-amber-500",
    soft: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    edge: "border-l-amber-500",
    wash: "bg-amber-50/70 dark:bg-amber-950/25",
  },
  offer: {
    dot: "bg-cyan-500",
    soft: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
    edge: "border-l-cyan-500",
    wash: "bg-cyan-50/70 dark:bg-cyan-950/25",
  },
  hired: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    edge: "border-l-emerald-500",
    wash: "bg-emerald-50/70 dark:bg-emerald-950/25",
  },
  rejected: {
    dot: "bg-rose-500",
    soft: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
    edge: "border-l-rose-500",
    wash: "bg-rose-50/70 dark:bg-rose-950/25",
  },
};

/** Below this AI score an application counts as not meeting the requirements. */
export const MISMATCH_SCORE = 40;

/** The recruiter's own verdict wins; otherwise the AI score decides. */
export function isMismatch(mismatch: boolean | null, score: number | null) {
  return mismatch ?? (score !== null && score < MISMATCH_SCORE);
}
