"use client";

import { useCallback, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getCvUrl, saveNotes } from "@/app/actions/candidates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CandidateForm,
  type CandidateFormValues,
  type JobOption,
} from "./candidate-form";

export type DrawerApplication = {
  id: string;
  jobTitle: string;
  stage: string;
  stageChangedAt: string;
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
  const s = useTranslations("Stages");
  const f = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [pending, startTransition] = useTransition();

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
        from: s(String(p.from)),
        to: s(String(p.to)),
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
              render={
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              LinkedIn
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
          <CandidateForm
            candidate={candidate}
            jobs={jobs}
            onDone={() => {
              setEditing(false);
              toast.success(t("updated"));
            }}
          />
        )}

        <Separator />
        <section className="grid gap-2">
          <h3 className="font-medium">{t("applications")}</h3>
          {applications.length ? (
            applications.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2"
              >
                <span>{a.jobTitle}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t("daysInStage", {
                      days: Math.floor(
                        (Date.now() - new Date(a.stageChangedAt).getTime()) /
                          86_400_000,
                      ),
                    })}
                  </span>
                  <Badge variant="secondary">{s(a.stage)}</Badge>
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">{t("noApplications")}</p>
          )}
        </section>

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
