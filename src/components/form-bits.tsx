"use client";

import { useTranslations } from "next-intl";
import { startTransition, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/auth/schemas";

/**
 * Pass `pending` when the form submits through `onSubmit` (see
 * `submitKeepingValues`), where useFormStatus does not see the submission.
 */
export function SubmitButton({
  children,
  className,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  className?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
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

/**
 * A submit handler that runs a form action without React resetting the form
 * afterwards, so the user keeps what they typed when the server returns an
 * error. `check` can stop the submission with an error key first.
 */
export function submitKeepingValues(
  dispatch: (formData: FormData) => void,
  check?: (formData: FormData) => string | null,
  onInvalid?: (error: string) => void,
) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const problem = check?.(formData);
    if (problem) {
      onInvalid?.(problem);
      return;
    }
    startTransition(() => dispatch(formData));
  };
}
