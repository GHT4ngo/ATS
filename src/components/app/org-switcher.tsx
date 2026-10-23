"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setActingOrganization } from "@/app/actions/admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

export function OrgSwitcher({
  organizations,
  activeId,
}: {
  organizations: { id: string; name: string }[];
  activeId: string | null;
}) {
  const t = useTranslations("Nav");
  const [pending, startTransition] = useTransition();
  const items = [
    { value: NONE, label: t("actAsNone") },
    ...organizations.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <Select
      items={items}
      value={activeId ?? NONE}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(() =>
          setActingOrganization(value === NONE ? "" : String(value)),
        )
      }
    >
      <SelectTrigger aria-label={t("actAs")} className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
