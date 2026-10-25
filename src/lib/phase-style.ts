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
    soft: "bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20 ring-inset dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
    edge: "border-l-blue-500/60",
    wash: "bg-blue-500/[0.04] dark:bg-blue-400/[0.04]",
  },
  screening: {
    dot: "bg-violet-500",
    soft: "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20 ring-inset dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
    edge: "border-l-violet-500/60",
    wash: "bg-violet-500/[0.04] dark:bg-violet-400/[0.04]",
  },
  interview: {
    dot: "bg-amber-500",
    soft: "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 ring-inset dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
    edge: "border-l-amber-500/60",
    wash: "bg-amber-500/[0.04] dark:bg-amber-400/[0.04]",
  },
  offer: {
    dot: "bg-cyan-500",
    soft: "bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/20 ring-inset dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20",
    edge: "border-l-cyan-500/60",
    wash: "bg-cyan-500/[0.04] dark:bg-cyan-400/[0.04]",
  },
  hired: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 ring-inset dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    edge: "border-l-emerald-500/60",
    wash: "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.04]",
  },
  rejected: {
    dot: "bg-rose-500",
    soft: "bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 ring-inset dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20",
    edge: "border-l-rose-500/60",
    wash: "bg-rose-500/[0.04] dark:bg-rose-400/[0.04]",
  },
};

/** Below this AI score an application counts as not meeting the requirements. */
export const MISMATCH_SCORE = 40;

/** The recruiter's own verdict wins; otherwise the AI score decides. */
export function isMismatch(mismatch: boolean | null, score: number | null) {
  return mismatch ?? (score !== null && score < MISMATCH_SCORE);
}
