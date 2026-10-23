"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setJobStatus } from "@/app/actions/jobs";
import { NativeSelect } from "@/components/ui/native-select";
import { JOB_STATUSES } from "@/lib/data/schemas";

export function JobStatusSelect({
  jobId,
  status,
  label,
}: {
  jobId: string;
  status: string;
  label: string;
}) {
  const t = useTranslations("Jobs");
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label={label}
      value={status}
      disabled={pending}
      className="h-8 w-32"
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => setJobStatus(jobId, next));
      }}
    >
      {JOB_STATUSES.map((v) => (
        <option key={v} value={v}>
          {t(`status.${v}`)}
        </option>
      ))}
    </NativeSelect>
  );
}
