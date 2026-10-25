"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A raised section whose header folds the body away. The choice is
 * remembered per section in this browser, under `storageKey`.
 */
export function FoldSection({
  id,
  storageKey,
  title,
  meta,
  aside,
  icon,
  foldedByDefault = false,
  className,
  children,
}: {
  id: string;
  storageKey: string;
  title: string;
  meta?: string;
  /** Shown at the right of the header: counts, progress. */
  aside?: React.ReactNode;
  icon?: React.ReactNode;
  foldedByDefault?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [folded, setFolded] = useState(foldedByDefault);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (typeof saved[id] === "boolean") setFolded(saved[id]);
    } catch {
      // No storage: the default stands.
    }
  }, [id, storageKey]);

  function toggle() {
    const next = !folded;
    setFolded(next);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...saved, [id]: next }),
      );
    } catch {
      // Not remembered, which is fine.
    }
  }

  const bodyId = `fold-${id}`;
  return (
    <section
      aria-label={title}
      className={cn(
        "bg-card/70 ring-foreground/[0.07] elevated rounded-2xl ring-1 backdrop-blur-sm",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={!folded}
        aria-controls={bodyId}
        onClick={toggle}
        className="hover:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-2"
      >
        <ChevronDown
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            folded && "-rotate-90",
          )}
        />
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          {meta && (
            <span className="text-muted-foreground block truncate text-xs">
              {meta}
            </span>
          )}
        </span>
        {aside}
      </button>
      {!folded && (
        <div id={bodyId} className="px-2 pb-2">
          {children}
        </div>
      )}
    </section>
  );
}
