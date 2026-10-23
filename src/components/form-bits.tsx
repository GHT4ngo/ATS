"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/auth/schemas";

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const t = useTranslations("Common");
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? t("saving") : children}
    </Button>
  );
}

/** Shows the error key from a server action, or an optional success message. */
export function FormMessage({
  state,
  success,
}: {
  state: ActionState;
  success?: string;
}) {
  const t = useTranslations("Errors");
  if (state.error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {t(state.error)}
      </p>
    );
  }
  if (state.ok && success) {
    return (
      <p
        role="status"
        className="text-sm text-emerald-600 dark:text-emerald-400"
      >
        {success}
      </p>
    );
  }
  return null;
}
