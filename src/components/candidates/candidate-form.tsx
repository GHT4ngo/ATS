"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createCandidate, updateCandidate } from "@/app/actions/candidates";
import {
  FormMessage,
  SubmitButton,
  submitKeepingValues,
} from "@/components/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/schemas";
import { MAX_CV_BYTES } from "@/lib/data/schemas";

export type CandidateFormValues = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  jobIds: string[];
  hasCv: boolean;
};

export type JobOption = { id: string; title: string };

export function CandidateForm({
  candidate,
  jobs,
  onDone,
}: {
  candidate?: CandidateFormValues;
  jobs: JobOption[];
  onDone: (state: ActionState) => void;
}) {
  const t = useTranslations("Candidates");
  const c = useTranslations("Common");
  const [state, action, pending] = useActionState(
    candidate ? updateCandidate.bind(null, candidate.id) : createCandidate,
    {},
  );
  const [localError, setLocalError] = useState<string>();

  useEffect(() => {
    if (state.ok) onDone(state);
  }, [state, onDone]);

  const checkCv = (formData: FormData) => {
    const cv = formData.get("cv");
    if (!(cv instanceof File) || cv.size === 0) return null;
    if (cv.size > MAX_CV_BYTES) return "cvTooLarge";
    if (cv.type !== "application/pdf") return "cvNotPdf";
    return null;
  };

  return (
    <form
      onSubmit={submitKeepingValues(
        (formData) => {
          setLocalError(undefined);
          action(formData);
        },
        checkCv,
        setLocalError,
      )}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="cand-name">{c("name")}</Label>
        <Input
          id="cand-name"
          name="fullName"
          required
          maxLength={200}
          defaultValue={candidate?.full_name}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="cand-email">{c("email")}</Label>
          <Input
            id="cand-email"
            name="email"
            type="email"
            maxLength={320}
            defaultValue={candidate?.email ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cand-phone">{t("phone")}</Label>
          <Input
            id="cand-phone"
            name="phone"
            maxLength={50}
            defaultValue={candidate?.phone ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cand-location">{t("location")}</Label>
          <Input
            id="cand-location"
            name="location"
            maxLength={200}
            defaultValue={candidate?.location ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cand-linkedin">{t("linkedin")}</Label>
          <Input
            id="cand-linkedin"
            name="linkedinUrl"
            type="url"
            maxLength={500}
            placeholder="https://www.linkedin.com/in/..."
            defaultValue={candidate?.linkedin_url ?? ""}
          />
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t("jobs")}</legend>
        {jobs.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {jobs.map((job) => (
              <label key={job.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="jobIds"
                  value={job.id}
                  defaultChecked={candidate?.jobIds.includes(job.id)}
                  className="size-4"
                />
                {job.title}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noJobs")}</p>
        )}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="cand-cv">
          {candidate?.hasCv ? t("replaceCv") : t("cv")}
        </Label>
        <Input id="cand-cv" name="cv" type="file" accept="application/pdf" />
        <p className="text-muted-foreground text-xs">{t("cvHint")}</p>
      </div>
      <FormMessage
        state={localError ? { error: localError } : state.ok ? {} : state}
      />
      <SubmitButton pending={pending}>{t("save")}</SubmitButton>
    </form>
  );
}
