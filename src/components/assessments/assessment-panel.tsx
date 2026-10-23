"use client";

import { useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { assessApplication } from "@/app/actions/assessments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScoreBadge } from "./score-badge";

export type AssessmentView = {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  skillMatches: {
    skill: string;
    match: "strong" | "partial" | "missing";
    evidence: string;
  }[];
  interviewQuestions: string[];
  model: string;
  createdAt: string;
};

const matchTone = {
  strong: "text-emerald-700 dark:text-emerald-400",
  partial: "text-amber-700 dark:text-amber-400",
  missing: "text-rose-700 dark:text-rose-400",
};

export function AssessmentPanel({
  applicationId,
  jobTitle,
  hasCv,
  assessment,
}: {
  applicationId: string;
  jobTitle: string;
  hasCv: boolean;
  assessment: AssessmentView | null;
}) {
  const t = useTranslations("Assessment");
  const e = useTranslations("Errors");
  const f = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await assessApplication(applicationId);
      if (result.error) toast.error(e(result.error));
      else {
        toast.success(t("done"));
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3" aria-busy={pending}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {assessment && (
            <ScoreBadge
              score={assessment.score}
              label={t("scoreLabel", { score: assessment.score })}
            />
          )}
          <span className="truncate font-medium">{jobTitle}</span>
        </span>
        <Button
          size="sm"
          variant={assessment ? "outline" : "default"}
          disabled={!hasCv || pending}
          onClick={run}
        >
          <Sparkles className="size-4" />
          {pending ? t("running") : assessment ? t("rerun") : t("run")}
        </Button>
      </div>
      {!hasCv && (
        <p className="text-muted-foreground text-xs">{t("needsCv")}</p>
      )}

      {assessment && (
        <div className="grid gap-3 text-sm">
          <p>{assessment.summary}</p>
          <List title={t("strengths")} items={assessment.strengths} />
          <List title={t("gaps")} items={assessment.gaps} />
          {assessment.skillMatches.length > 0 && (
            <div className="grid gap-1">
              <h4 className="font-medium">{t("skills")}</h4>
              <ul className="grid gap-1">
                {assessment.skillMatches.map((m, i) => (
                  <li key={i}>
                    <span className="font-medium">{m.skill}</span>{" "}
                    <span className={cn("text-xs", matchTone[m.match])}>
                      {t(`match.${m.match}`)}
                    </span>
                    {m.evidence && (
                      <span className="text-muted-foreground block text-xs">
                        {m.evidence}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <List
            title={t("questions")}
            items={assessment.interviewQuestions}
            ordered
          />
          <p className="text-muted-foreground text-xs">
            {t("meta", {
              date: f.dateTime(new Date(assessment.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
              model: assessment.model,
            })}
          </p>
        </div>
      )}
    </div>
  );
}

function List({
  title,
  items,
  ordered,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className="grid gap-1">
      <h4 className="font-medium">{title}</h4>
      <Tag
        className={cn(
          "grid gap-1 pl-5",
          ordered ? "list-decimal" : "list-disc",
        )}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}
