"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type PaletteItem = {
  id: string;
  group: "pages" | "candidates" | "jobs";
  label: string;
  href: string;
};

export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .slice(0, 30);
  }, [items, query]);

  function go(item: PaletteItem) {
    setOpen(false);
    router.push(item.href);
  }

  const groups = [
    { key: "pages", label: t("pages"), Icon: Search },
    { key: "candidates", label: t("candidatesGroup"), Icon: User },
    { key: "jobs", label: t("jobsGroup"), Icon: Briefcase },
  ] as const;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("search")}</span>
        <kbd className="bg-muted rounded px-1.5 text-xs">Ctrl K</kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setQuery("");
          setActive(0);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogTitle className="sr-only">{t("search")}</DialogTitle>
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
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
                <div key={key} className="mb-2">
                  <p className="text-muted-foreground px-2 py-1 text-xs">
                    {label}
                  </p>
                  {inGroup.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
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
    </>
  );
}
