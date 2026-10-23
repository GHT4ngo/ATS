"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ErrorView({ reset }: { reset: () => void }) {
  const c = useTranslations("Common");
  return (
    <div
      className="grid place-items-center gap-3 py-24 text-center"
      role="alert"
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        {c("somethingWrong")}
      </h1>
      <p className="text-muted-foreground">{c("somethingWrongBody")}</p>
      <Button onClick={reset}>{c("tryAgain")}</Button>
    </div>
  );
}
