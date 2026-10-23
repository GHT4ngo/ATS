"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { setNewPassword } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Used on the reset page and in the settings. */
export function PasswordForm({ showContinue }: { showContinue?: boolean }) {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(setNewPassword, {});

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">{t("confirmPassword")}</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <FormMessage state={state} success={t("resetDone")} />
      <SubmitButton>{t("resetButton")}</SubmitButton>
      {showContinue && state.ok && (
        <Link href="/dashboard" className="text-center text-sm underline">
          {t("continue")}
        </Link>
      )}
    </form>
  );
}
