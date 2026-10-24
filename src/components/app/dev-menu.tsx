"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Wrench } from "lucide-react";
import { exitCustomerPreview, startCustomerPreview } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Admin tools for trying the app out, shown in developer mode. */
export function DevMenu({
  organizations,
  previewing,
}: {
  organizations: { id: string; name: string }[];
  /** The organization being previewed, if any. */
  previewing: string | null;
}) {
  const t = useTranslations("Dev");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("menu")}
            title={t("menu")}
            disabled={pending}
            className="text-violet-600 dark:text-violet-400"
          />
        }
      >
        <Wrench className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("previewAs")}</DropdownMenuLabel>
          {organizations.map((o) => (
            <DropdownMenuItem
              key={o.id}
              disabled={o.id === previewing}
              onClick={() => startTransition(() => startCustomerPreview(o.id))}
            >
              <Eye className="size-4" />
              {o.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {previewing && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => startTransition(() => exitCustomerPreview())}
            >
              <EyeOff className="size-4" />
              {t("exitPreview")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
