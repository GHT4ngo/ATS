"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/auth/schemas";

const squash = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * A button that asks before it runs an action. With `confirmText`, the user
 * has to type that text first, for actions that cannot be undone.
 */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  confirmText,
  success,
  run,
  onDone,
  variant = "outline",
  destructive = false,
}: {
  label: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  confirmText?: string;
  success: string;
  run: () => Promise<ActionState>;
  onDone?: () => void;
  variant?: "outline" | "destructive" | "ghost";
  destructive?: boolean;
}) {
  const c = useTranslations("Confirm");
  const e = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  // Extra spaces do not count, so a name stored with a double space matches.
  const blocked =
    confirmText !== undefined && squash(typed) !== squash(confirmText);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger render={<Button variant={variant} size="sm" />}>
        {label}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {confirmText !== undefined && (
          <label className="grid gap-2 text-sm">
            {c("typeToConfirm", { text: squash(confirmText) })}
            <Input
              value={typed}
              onChange={(ev) => setTyped(ev.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {c("cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending || blocked}
            onClick={() =>
              startTransition(async () => {
                const res = await run();
                if (!res.ok) {
                  toast.error(e(res.error ?? "generic"));
                  return;
                }
                if (res.error) toast.warning(e(res.error));
                else toast.success(success);
                setOpen(false);
                onDone?.();
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
