"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { setDevMode } from "@/app/actions/admin";
import { PasswordForm } from "@/components/auth/password-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ProfileForm } from "./profile-form";

export function SettingsDialog({
  fullName,
  locale,
  devMode,
}: {
  fullName: string;
  locale: "sv" | "en";
  /** Admins only; undefined hides the developer section. */
  devMode?: boolean;
}) {
  const t = useTranslations("Settings");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("title")}
            title={t("title")}
          />
        }
      >
        <Settings className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("profileDescription")}</DialogDescription>
        </DialogHeader>
        <ProfileForm fullName={fullName} locale={locale} />
        <Separator />
        <section className="grid gap-3">
          <div>
            <h3 className="font-medium">{t("passwordTitle")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("passwordDescription")}
            </p>
          </div>
          <PasswordForm />
        </section>
        {devMode !== undefined && (
          <>
            <Separator />
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block font-medium">{t("devMode")}</span>
                <span className="text-muted-foreground block text-sm">
                  {t("devModeDescription")}
                </span>
              </span>
              <Switch
                checked={devMode}
                disabled={pending}
                onCheckedChange={(on) => startTransition(() => setDevMode(on))}
              />
            </label>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
