"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ initialError }: { initialError?: string }) {
  const t = useTranslations("Auth");
  const c = useTranslations("Common");
  const [state, action] = useActionState(
    login,
    initialError ? { error: initialError } : {},
  );

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
      <div className="grid gap-2">
        <Label htmlFor="password">{c("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("loginButton")}</SubmitButton>
      <Link
        href="/forgot-password"
        className="text-muted-foreground text-center text-sm underline"
      >
        {t("forgotLink")}
      </Link>
    </form>
  );
}
