"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { resetUserPassword, setUserActive } from "@/app/actions/admin";
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
import { generatePassword } from "./generate-password";

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
            <div className="grid gap-2">
              <Label htmlFor={`reset-${userId}`}>
                {t("temporaryPassword")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`reset-${userId}`}
                  name="password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  minLength={10}
                  required
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPassword(generatePassword())}
                >
                  {t("generatePassword")}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {t("temporaryPasswordHint")}
              </p>
            </div>
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
          onClick={toggleActive}
        >
          {isActive ? t("deactivate") : t("reactivate")}
        </Button>
      )}
    </div>
  );
}
