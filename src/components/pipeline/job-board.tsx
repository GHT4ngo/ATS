import { useTranslations } from "next-intl";
import { CircleCheck } from "lucide-react";
import { FoldSection } from "@/components/fold-section";
import { cn } from "@/lib/utils";

/**
 * A job's section on the pipeline page: a header with the hiring progress,
 * which folds the board away. Filled and closed jobs start folded.
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
  const filled = hired >= openings;
  return (
    <FoldSection
      id={jobId}
      storageKey="ats.board.jobs"
      title={title}
      meta={meta}
      foldedByDefault={foldedByDefault}
      aside={
        <>
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
          >
            {filled && <CircleCheck className="size-3.5" />}
            {t("hiredOf", { hired, openings })}
          </span>
        </>
      }
    >
      {children}
    </FoldSection>
  );
}
