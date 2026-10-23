"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN } from "@/lib/auth/schemas";
import { generatePassword } from "./generate-password";

export function TemporaryPasswordField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("Admin");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t("temporaryPassword")}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={PASSWORD_MIN}
          required
          autoComplete="off"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(generatePassword())}
        >
          {t("generatePassword")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("temporaryPasswordHint")}
      </p>
    </div>
  );
}
