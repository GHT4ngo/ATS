"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, Search, User } from "lucide-react";
import { searchEverything, type SearchResult } from "@/app/actions/search";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Item = {
  id: string;
  group: "pages" | SearchResult["group"];
  label: string;
  href: string;
};

export function CommandPalette({
  open,
  onOpenChange,
  pages,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: { href: string; label: string }[];
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchEverything(query).catch(() => []);
      if (!cancelled) setFound(results);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const results = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const matchingPages = pages
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .map((p) => ({ id: p.href, group: "pages" as const, ...p }));
    return [...matchingPages, ...found];
  }, [pages, found, query]);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setFound([]);
      setActive(0);
    }
  }

  function go(item: Item) {
    close(false);
    onNavigate?.();
    router.push(item.href);
  }

  const groups = [
    { key: "pages", label: t("pages"), Icon: Search },
    { key: "candidates", label: t("candidatesGroup"), Icon: User },
    { key: "jobs", label: t("jobsGroup"), Icon: Briefcase },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogTitle className="sr-only">{t("search")}</DialogTitle>
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={
            results[active] ? `palette-${results[active].id}` : undefined
          }
          value={query}
          placeholder={t("searchPlaceholder")}
          className="bg-transparent text-sm outline-none"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              go(results[active]);
            }
          }}
        />
        <div
          id="palette-list"
          role="listbox"
          className="max-h-80 overflow-y-auto"
        >
          {results.length === 0 && (
            <p className="text-muted-foreground py-6 text-center">
              {t("noResults")}
            </p>
          )}
          {groups.map(({ key, label, Icon }) => {
            const inGroup = results.filter((r) => r.group === key);
            if (!inGroup.length) return null;
            return (
              <div key={key} role="group" aria-label={label} className="mb-2">
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  {label}
                </p>
                {inGroup.map((item) => (
                  <button
                    key={item.id}
                    id={`palette-${item.id}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={results[active]?.id === item.id}
                    onMouseEnter={() => setActive(results.indexOf(item))}
                    onClick={() => go(item)}
                    className="aria-selected:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
