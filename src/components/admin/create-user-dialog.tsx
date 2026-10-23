"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createUser } from "@/app/actions/admin";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemporaryPasswordField } from "./temporary-password-field";

export function CreateUserDialog({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const t = useTranslations("Admin");
  const c = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("customer");
  const [password, setPassword] = useState("");
  const [state, action] = useActionState(createUser, {});

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setPassword("");
      toast.success(t("userCreated"));
    }
  }, [state, t]);

  const roles = [
    { value: "customer", label: c("customer") },
    { value: "admin", label: c("admin") },
  ];
  const orgItems = organizations.map((o) => ({ value: o.id, label: o.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("newUser")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newUser")}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-name">{c("name")}</Label>
            <Input id="user-name" name="fullName" required maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">{c("email")}</Label>
            <Input
              id="user-email"
              name="email"
              type="email"
              required
              maxLength={320}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-role">{c("role")}</Label>
            <Select
              name="role"
              items={roles}
              value={role}
              onValueChange={(v) => setRole(String(v))}
            >
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === "customer" && (
            <div className="grid gap-2">
              <Label htmlFor="user-org">{c("organization")}</Label>
              <Select name="organizationId" items={orgItems} required>
                <SelectTrigger id="user-org" className="w-full">
                  <SelectValue placeholder={t("selectOrganization")} />
                </SelectTrigger>
                <SelectContent>
                  {orgItems.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <TemporaryPasswordField
            id="user-password"
            value={password}
            onChange={setPassword}
          />
          <FormMessage state={state} />
          <SubmitButton>{c("create")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
