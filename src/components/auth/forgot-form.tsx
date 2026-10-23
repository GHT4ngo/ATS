"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotForm() {
  const t = useTranslations("Auth");
  const c = useTranslations("Common");
  const [state, action] = useActionState(requestPasswordReset, {});

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">{c("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <FormMessage state={state} success={t("forgotSent")} />
      <SubmitButton>{t("forgotButton")}</SubmitButton>
      <Link
        href="/login"
        className="text-muted-foreground text-center text-sm underline"
      >
        {t("backToLogin")}
      </Link>
    </form>
  );
}
