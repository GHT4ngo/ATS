"use client";

import { useCallback, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getCvUrl, saveNotes } from "@/app/actions/candidates";
import {
  AssessmentPanel,
  type AssessmentView,
} from "@/components/assessments/assessment-panel";
import { MarkButtons, MismatchMenu } from "@/components/pipeline/marks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/auth/schemas";
import { Separator } from "@/components/ui/separator";
import type { Stage } from "@/lib/data/schemas";
import { PHASE_STYLE } from "@/lib/phase-style";
import { cn } from "@/lib/utils";
import {
  CandidateForm,
  type CandidateFormValues,
  type JobOption,
} from "./candidate-form";

export type DrawerApplication = {
  id: string;
  jobTitle: string;
  stage: Stage;
  stageName: string | null;
  /** Days in the current stage, counted on the server. */
  days: number;
  assessment: AssessmentView | null;
  starred: boolean;
  flagged: boolean;
  /** The recruiter's verdict; null follows the AI score. */
  mismatch: boolean | null;
  effectiveMismatch: boolean;
};

export type DrawerActivity = {
  id: number;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
  actor: string | null;
};

export function CandidateDrawer({
  candidate,
  notes,
  jobs,
  applications,
  activity,
}: {
  candidate: CandidateFormValues;
  notes: string;
  jobs: JobOption[];
  applications: DrawerApplication[];
  activity: DrawerActivity[];
}) {
  const t = useTranslations("Candidates");
  const ai = useTranslations("Assessment");
  const s = useTranslations("Stages");
  const f = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [pending, startTransition] = useTransition();

  const e = useTranslations("Errors");
  const onEdited = useCallback(
    (state: ActionState) => {
      setEditing(false);
      if (state.error) toast.warning(e(state.error));
      else toast.success(t("updated"));
    },
    [t, e],
  );

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("candidate");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const describe = (a: DrawerActivity) => {
    const p = a.payload;
    if (a.action === "moved") {
      return t("activity.moved", {
        job: String(p.job ?? ""),
        from: p.from_stage ? String(p.from_stage) : s(String(p.from)),
        to: p.to_stage ? String(p.to_stage) : s(String(p.to)),
      });
    }
    if (a.action === "assessed") {
      return t("activity.assessed", {
        job: String(p.job ?? ""),
        score: Number(p.score),
      });
    }
    if (a.action === "created") return t("activity.created");
    if (a.action === "updated") return t("activity.updated");
    if (a.action === "notes") return t("activity.notes");
    return a.action;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="top-0 right-0 left-auto h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{candidate.full_name}</DialogTitle>
          <DialogDescription>
            {[candidate.email, candidate.phone, candidate.location]
              .filter(Boolean)
              .join(" · ") || t("noContact")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {candidate.linkedin_url && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              {t("linkedin")}
            </Button>
          )}
          {candidate.hasCv && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const url = await getCvUrl(candidate.id);
                if (url) window.open(url, "_blank", "noopener");
                else toast.error(t("cvMissing"));
              }}
            >
              {t("openCv")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? t("cancelEdit") : t("editProfile")}
          </Button>
        </div>

        {editing && (
          <CandidateForm candidate={candidate} jobs={jobs} onDone={onEdited} />
        )}

        <Separator />
        <section className="grid gap-2">
          <h3 className="font-medium">{t("applications")}</h3>
          {applications.length ? (
            applications.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "grid gap-2 rounded-lg border border-l-4 p-2",
                  PHASE_STYLE[a.stage].edge,
                  a.effectiveMismatch &&
                    "border-rose-300 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    {a.jobTitle}
                  </span>
                  <MarkButtons
                    applicationId={a.id}
                    starred={a.starred}
                    flagged={a.flagged}
                    size="md"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium",
                      PHASE_STYLE[a.stage].soft,
                    )}
                  >
                    {a.stageName ?? s(a.stage)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t("daysInStage", { days: a.days })}
                  </span>
                  <span className="ml-auto">
                    <MismatchMenu
                      applicationId={a.id}
                      mismatch={a.mismatch}
                      effective={a.effectiveMismatch}
                    />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">{t("noApplications")}</p>
          )}
        </section>

        {applications.length > 0 && (
          <>
            <Separator />
            <section className="grid gap-2">
              <h3 className="font-medium">{ai("heading")}</h3>
              <p className="text-muted-foreground text-xs">
                {ai("disclaimer")}
              </p>
              {applications.map((a) => (
                <AssessmentPanel
                  key={a.id}
                  applicationId={a.id}
                  jobTitle={a.jobTitle}
                  hasCv={candidate.hasCv}
                  assessment={a.assessment}
                />
              ))}
            </section>
          </>
        )}

        <Separator />
        <section className="grid gap-2">
          <h3 className="font-medium">{t("notes")}</h3>
          <textarea
            aria-label={t("notes")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            maxLength={20000}
            className="border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
          <Button
            size="sm"
            className="w-fit"
            disabled={pending || draft === notes}
            onClick={() =>
              startTransition(async () => {
                const res = await saveNotes(candidate.id, draft);
                if (res.ok) {
                  toast.success(t("notesSaved"));
                  router.refresh();
                } else toast.error(t("notesFailed"));
              })
            }
          >
            {t("saveNotes")}
          </Button>
        </section>

        <Separator />
        <section className="grid gap-2">
          <h3 className="font-medium">{t("timeline")}</h3>
          <ol className="grid gap-2">
            {activity.map((a) => (
              <li key={a.id} className="text-sm">
                <div>{describe(a)}</div>
                <div className="text-muted-foreground text-xs">
                  {[
                    a.actor,
                    f.dateTime(new Date(a.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </DialogContent>
    </Dialog>
  );
}
