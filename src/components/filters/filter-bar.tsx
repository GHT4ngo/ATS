"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Name search and an optional multi select of jobs. Both live in the URL
 * (`q` and `jobs`, a comma separated list of ids) so a filtered view can be
 * shared. The open candidate (`candidate`) is kept when filters change.
 */
export function FilterBar({
  jobs,
}: {
  jobs?: { id: string; title: string }[];
}) {
  const t = useTranslations("Filters");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const selected = new Set(
    (params.get("jobs") ?? "").split(",").filter(Boolean),
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    update("jobs", [...next].join(","));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        aria-label={t("search")}
        placeholder={t("search")}
        value={q}
        className="w-56"
        onChange={(e) => {
          setQ(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(
            () => update("q", e.target.value.trim()),
            250,
          );
        }}
      />
      {jobs && jobs.length > 0 && (
        <div
          role="group"
          aria-label={t("jobs")}
          className="flex flex-wrap items-center gap-1.5"
        >
          {jobs.map((job) => {
            const on = selected.has(job.id);
            return (
              <Button
                key={job.id}
                type="button"
                size="sm"
                variant={on ? "default" : "outline"}
                aria-pressed={on}
                className={cn("max-w-48 truncate")}
                onClick={() => toggle(job.id)}
              >
                {job.title}
              </Button>
            );
          })}
          {selected.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => update("jobs", "")}
            >
              {t("clear")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
