"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createOrganization } from "@/app/actions/admin";
import { FormMessage, SubmitButton } from "@/components/form-bits";
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

export function CreateOrganizationDialog() {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createOrganization, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success(t("organizationCreated"));
    }
  }, [state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("newOrganization")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newOrganization")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="org-name">{t("organizationName")}</Label>
            <Input id="org-name" name="name" required maxLength={200} />
          </div>
          <FormMessage state={state} />
          <SubmitButton>{t("newOrganization")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
