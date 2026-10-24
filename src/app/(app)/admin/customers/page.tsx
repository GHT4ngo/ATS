import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { setActingOrganization } from "@/app/actions/admin";
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  organization_id: string | null;
};

/** Organizations and their users on one page; admins have their own card. */
export default async function CustomersPage() {
  const { profile: me } = await requireAdmin();
  const t = await getTranslations("Admin");
  const c = await getTranslations("Common");
  const format = await getFormatter();
  const supabase = await createClient();

  const [{ data: organizations }, { data: users }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, slug, created_at")
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, organization_id")
        .order("full_name"),
      supabase.from("jobs").select("organization_id").eq("status", "open"),
    ]);
  const orgs = organizations ?? [];
  const openJobs = new Map<string, number>();
  for (const j of jobs ?? [])
    openJobs.set(j.organization_id, (openJobs.get(j.organization_id) ?? 0) + 1);
  const admins = (users ?? []).filter((u) => u.role === "admin");
  const orgIds = new Set(orgs.map((o) => o.id));
  // Customers whose organization is missing still need to be reachable.
  const unassigned = (users ?? []).filter(
    (u) =>
      u.role !== "admin" &&
      (!u.organization_id || !orgIds.has(u.organization_id)),
  );
  const membersOf = (orgId: string) =>
    (users ?? []).filter(
      (u) => u.role !== "admin" && u.organization_id === orgId,
    );

  async function open(organizationId: string) {
    "use server";
    await setActingOrganization(organizationId);
    redirect("/dashboard");
  }

  const userList = (list: User[]) =>
    list.length ? (
      <ul className="divide-y">
        {list.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                u.is_active ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {u.full_name || u.email}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {u.email}
              </span>
            </span>
            {!u.is_active && <Badge variant="outline">{c("inactive")}</Badge>}
            <UserActions
              userId={u.id}
              name={u.full_name || u.email || ""}
              isActive={u.is_active}
              isSelf={u.id === me.id}
            />
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-muted-foreground py-2 text-sm">{t("noUsers")}</p>
    );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("customersTitle")}
          </h1>
          <p className="text-muted-foreground">{t("customersDescription")}</p>
        </div>
        <div className="flex gap-2">
          <CreateOrganizationDialog />
          <CreateUserDialog organizations={orgs} />
        </div>
      </div>

      {orgs.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {orgs.map((o) => {
            const members = membersOf(o.id);
            return (
              <Card
                key={o.id}
                role="region"
                aria-label={o.name}
                className="border-t-4 border-t-violet-500"
              >
                <CardHeader className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{o.name}</CardTitle>
                    <p className="text-muted-foreground text-xs">
                      {[
                        o.slug,
                        t("sinceDate", {
                          date: format.dateTime(new Date(o.created_at), {
                            dateStyle: "medium",
                          }),
                        }),
                      ].join(" · ")}
                    </p>
                  </div>
                  <form action={open.bind(null, o.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      {t("openOrganization")}
                      <ArrowRight className="size-4" />
                    </Button>
                  </form>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge className="bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                      {t("userCount", { count: members.length })}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                      {t("openJobCount", { count: openJobs.get(o.id) ?? 0 })}
                    </Badge>
                  </div>
                  {userList(members)}
                  <CreateUserDialog
                    organizations={orgs}
                    organizationId={o.id}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground">{t("noOrganizations")}</p>
      )}

      {unassigned.length > 0 && (
        <Card role="region" aria-label={t("unassigned")}>
          <CardHeader>
            <CardTitle>{t("unassigned")}</CardTitle>
          </CardHeader>
          <CardContent>{userList(unassigned)}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-violet-600 dark:text-violet-400" />
            {t("administrators")}
          </CardTitle>
        </CardHeader>
        <CardContent>{userList(admins)}</CardContent>
      </Card>
    </div>
  );
}
