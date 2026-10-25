"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createJob, updateJob } from "@/app/actions/jobs";
import {
  FormMessage,
  SubmitButton,
  submitKeepingValues,
} from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "@/lib/data/schemas";

export type JobFormValues = {
  id: string;
  title: string;
  description: string;
  location: string;
  employment_type: string;
  status: string;
  openings: number;
};

export function JobFormDialog({ job }: { job?: JobFormValues }) {
  const t = useTranslations("Jobs");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    job ? updateJob.bind(null, job.id) : createJob,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(job ? t("updated") : t("created"));
    }
  }, [state, job, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={job ? "outline" : "default"}
            size={job ? "sm" : "default"}
          />
        }
      >
        {job ? t("edit") : t("new")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{job ? t("edit") : t("new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submitKeepingValues(action)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="job-title">{t("title")}</Label>
            <Input
              id="job-title"
              name="title"
              required
              maxLength={200}
              defaultValue={job?.title}
            />
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-4">
            <div className="grid gap-2">
              <Label htmlFor="job-location">{t("location")}</Label>
              <Input
                id="job-location"
                name="location"
                maxLength={200}
                defaultValue={job?.location}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-openings">{t("openings")}</Label>
              <Input
                id="job-openings"
                name="openings"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                required
                defaultValue={job?.openings ?? 1}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="job-type">{t("employmentType")}</Label>
              <NativeSelect
                id="job-type"
                name="employmentType"
                defaultValue={job?.employment_type ?? "full_time"}
              >
                {EMPLOYMENT_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`type.${v}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-status">{t("statusLabel")}</Label>
              <NativeSelect
                id="job-status"
                name="status"
                defaultValue={job?.status ?? "open"}
              >
                {JOB_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {t(`status.${v}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="job-description">{t("description")}</Label>
            <textarea
              id="job-description"
              name="description"
              rows={6}
              maxLength={20000}
              defaultValue={job?.description}
              className="border-input bg-background dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
            />
          </div>
          <FormMessage state={state} />
          <SubmitButton pending={pending}>{t("save")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
