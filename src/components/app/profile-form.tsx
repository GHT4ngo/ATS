"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/app/actions/profile";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProfileForm({
  fullName,
  locale,
}: {
  fullName: string;
  locale: "sv" | "en";
}) {
  const t = useTranslations("Settings");
  const c = useTranslations("Common");
  const [state, action] = useActionState(updateProfile, {});
  const languages = [
    { value: "sv", label: c("swedish") },
    { value: "en", label: c("english") },
  ];

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          required
          maxLength={200}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="locale">{t("language")}</Label>
        <Select name="locale" items={languages} defaultValue={locale}>
          <SelectTrigger id="locale" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormMessage state={state} success={c("saved")} />
      <SubmitButton className="justify-self-start">{c("save")}</SubmitButton>
    </form>
  );
}
