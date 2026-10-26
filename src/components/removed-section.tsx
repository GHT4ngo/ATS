"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { eraseCandidate, purgeJob, restoreItem } from "@/app/actions/removed";
import { ConfirmButton } from "@/components/confirm-button";
import { FoldSection } from "@/components/fold-section";
import type { RemovedItem } from "@/lib/data/removed";

/**
 * Admin only: the candidates or jobs that have been removed in this
 * organization, with restore and permanent delete. Customers never get here.
 */
export function RemovedSection({
  entity,
  items,
  storageKey,
}: {
  entity: "candidate" | "job";
  items: RemovedItem[];
  storageKey: string;
}) {
  const r = useTranslations("Removal");
  const f = useFormatter();
  if (!items.length) return null;

  return (
    <FoldSection
      id="removed"
      storageKey={storageKey}
      title={r("removedHeading")}
      meta={r("removedNote", { count: items.length })}
      foldedByDefault
      icon={
        <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-300">
          <Trash2 className="size-4" />
        </span>
      }
      className="bg-rose-500/[0.04] ring-rose-500/20 dark:bg-rose-400/[0.05]"
    >
      <ul className="divide-y divide-rose-500/10">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-2 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {[
                  item.detail,
                  r("removedBy", {
                    date: f.dateTime(new Date(item.removedAt), {
                      dateStyle: "medium",
                    }),
                    name: item.removedBy ?? r("unknownUser"),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="flex gap-2">
              <ConfirmButton
                label={r("restore")}
                title={r("restoreTitle", { name: item.name })}
                description={r(
                  entity === "candidate"
                    ? "restoreCandidateBody"
                    : "restoreJobBody",
                )}
                confirmLabel={r("restore")}
                success={r("restored")}
                run={() => restoreItem(entity, item.id)}
              />
              <ConfirmButton
                label={r(entity === "candidate" ? "erase" : "purge")}
                variant="destructive"
                destructive
                title={
                  entity === "candidate"
                    ? r("eraseTitle", { name: item.name })
                    : r("purgeTitle", { title: item.name })
                }
                description={r(
                  entity === "candidate" ? "eraseBody" : "purgeBody",
                )}
                confirmLabel={r(entity === "candidate" ? "erase" : "purge")}
                confirmText={item.name}
                success={r(entity === "candidate" ? "erased" : "purged")}
                run={() =>
                  entity === "candidate"
                    ? eraseCandidate(item.id)
                    : purgeJob(item.id)
                }
              />
            </span>
          </li>
        ))}
      </ul>
    </FoldSection>
  );
}
