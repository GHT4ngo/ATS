"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/auth/schemas";
import { CandidateForm, type JobOption } from "./candidate-form";

export function NewCandidateDialog({ jobs }: { jobs: JobOption[] }) {
  const t = useTranslations("Candidates");
  const [open, setOpen] = useState(false);
  const e = useTranslations("Errors");
  const done = useCallback(
    (state: ActionState) => {
      setOpen(false);
      if (state.error) toast.warning(e(state.error));
      else toast.success(t("created"));
    },
    [t, e],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("new")}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
        </DialogHeader>
        <CandidateForm jobs={jobs} onDone={done} />
      </DialogContent>
    </Dialog>
  );
}
