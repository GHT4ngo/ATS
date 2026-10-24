"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Flag, Sparkles, Star, X } from "lucide-react";
import { toast } from "sonner";
import { markApplication } from "@/app/actions/pipeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Marks = { starred: boolean; flagged: boolean };

/**
 * Star and flag toggles. Updates at once and puts the old value back if the
 * server says no; the server action refreshes the page with the saved marks.
 */
export function MarkButtons({
  applicationId,
  starred,
  flagged,
  size = "sm",
}: Marks & { applicationId: string; size?: "sm" | "md" }) {
  const t = useTranslations("Marks");
  const e = useTranslations("Errors");
  const [marks, setMarks] = useState<Marks>({ starred, flagged });
  const [seen, setSeen] = useState<Marks>({ starred, flagged });
  // One change at a time, so a failed one rolls back to a value the server has.
  const [pending, startTransition] = useTransition();

  if (seen.starred !== starred || seen.flagged !== flagged) {
    setSeen({ starred, flagged });
    setMarks({ starred, flagged });
  }

  function toggle(mark: keyof Marks) {
    const value = !marks[mark];
    setMarks((m) => ({ ...m, [mark]: value }));
    startTransition(async () => {
      let error: string | undefined = "generic";
      try {
        error = (await markApplication({ applicationId, mark, value })).error;
      } catch {
        // A network failure or a crash rolls back like a refusal.
      }
      if (error) {
        setMarks((m) => ({ ...m, [mark]: !value }));
        toast.error(e(error));
      }
    });
  }

  const icon = size === "sm" ? "size-3.5" : "size-4";
  const button = cn(
    "focus-visible:ring-ring inline-flex items-center justify-center rounded-md outline-none focus-visible:ring-2",
    size === "sm" ? "size-6" : "size-8 border",
  );

  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        aria-pressed={marks.starred}
        aria-label={marks.starred ? t("unstar") : t("star")}
        title={marks.starred ? t("unstar") : t("star")}
        className={cn(
          button,
          marks.starred
            ? "text-amber-500"
            : "text-muted-foreground/60 hover:text-amber-500",
        )}
        onPointerDown={(ev) => ev.stopPropagation()}
        onKeyDown={(ev) => ev.stopPropagation()}
        disabled={pending}
        onClick={() => toggle("starred")}
      >
        <Star className={cn(icon, marks.starred && "fill-amber-400")} />
      </button>
      <button
        type="button"
        aria-pressed={marks.flagged}
        aria-label={marks.flagged ? t("unflag") : t("flag")}
        title={marks.flagged ? t("unflag") : t("flag")}
        className={cn(
          button,
          marks.flagged
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground/60 hover:text-rose-600",
        )}
        onPointerDown={(ev) => ev.stopPropagation()}
        onKeyDown={(ev) => ev.stopPropagation()}
        disabled={pending}
        onClick={() => toggle("flagged")}
      >
        <Flag className={cn(icon, marks.flagged && "fill-current")} />
      </button>
    </span>
  );
}

const AUTO = "auto";

/** The recruiter's verdict on the requirements; Auto follows the AI score. */
export function MismatchMenu({
  applicationId,
  mismatch,
  effective,
}: {
  applicationId: string;
  mismatch: boolean | null;
  /** What the card shows now, after the AI score is taken into account. */
  effective: boolean;
}) {
  const t = useTranslations("Marks");
  const e = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const value = mismatch === null ? AUTO : mismatch ? "no" : "yes";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium",
          effective
            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
            : "bg-muted text-muted-foreground",
        )}
      >
        {effective ? <X className="size-3" /> : <Check className="size-3" />}
        {effective ? t("mismatch") : t("requirements")}
        {mismatch === null && <Sparkles className="size-3 opacity-70" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) =>
            startTransition(async () => {
              const next = v === AUTO ? null : v === "no";
              let error: string | undefined = "generic";
              try {
                error = (
                  await markApplication({
                    applicationId,
                    mark: "mismatch",
                    value: next,
                  })
                ).error;
              } catch {
                // Reported below, like a refusal.
              }
              if (error) toast.error(e(error));
            })
          }
        >
          <DropdownMenuRadioItem value={AUTO}>
            {t("auto")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="no">
            {t("markMismatch")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="yes">
            {t("markFits")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
