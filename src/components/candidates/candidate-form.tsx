"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createCandidate, updateCandidate } from "@/app/actions/candidates";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  onDone: () => void;
}) {
  const t = useTranslations("Candidates");
  const c = useTranslations("Common");
  const [state, action] = useActionState(
    candidate ? updateCandidate.bind(null, candidate.id) : createCandidate,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-4">
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
          <Label htmlFor="cand-linkedin">LinkedIn</Label>
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
      <FormMessage state={state} />
      <SubmitButton>{t("save")}</SubmitButton>
    </form>
  );
}
