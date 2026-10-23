"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { resetUserPassword, setUserActive } from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TemporaryPasswordField } from "./temporary-password-field";

export function UserActions({
  userId,
  name,
  isActive,
  isSelf,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("Admin");
  const e = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, action] = useActionState(resetUserPassword, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setPassword("");
      toast.success(t("resetPasswordDone"));
    }
  }, [state, t]);

  function toggleActive() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await setUserActive(userId, !isActive);
      if (result.error) toast.error(e(result.error));
      else
        toast.success(isActive ? t("userDeactivated") : t("userReactivated"));
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          {t("resetPassword")}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetPasswordFor", { name })}</DialogTitle>
          </DialogHeader>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="userId" value={userId} />
            <TemporaryPasswordField
              id={`reset-${userId}`}
              value={password}
              onChange={setPassword}
            />
            <FormMessage state={state} />
            <SubmitButton>{t("resetPassword")}</SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
      {!isSelf && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => (isActive ? setConfirmOpen(true) : toggleActive())}
        >
          {isActive ? t("deactivate") : t("reactivate")}
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmDeactivateTitle", { name })}
        description={t("confirmDeactivateBody")}
        confirmLabel={t("deactivate")}
        pending={pending}
        onConfirm={toggleActive}
      />
    </div>
  );
}
