import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, ShieldCheck, UserX } from "lucide-react";
import { setActingOrganization } from "@/app/actions/admin";
import { CreateOrganizationDialog } from "@/components/admin/create-organization-dialog";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn, initials } from "@/lib/utils";

type User = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  organization_id: string | null;
};

/**
 * Every user on one page: the administrators first, then one card per
 * organization in alphabetical order. The cards share one size and scroll
 * inside, so the grid stays even however many users an organization has.
 */
export default async function UsersPage() {
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
  const orgs = (organizations ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, "sv"),
  );
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
      <ul className="divide-y overflow-y-auto pr-1">
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
            {t("usersTitle")}
          </h1>
          <p className="text-muted-foreground">{t("usersDescription")}</p>
        </div>
        <div className="flex gap-2">
          <CreateOrganizationDialog />
          <CreateUserDialog organizations={orgs} />
        </div>
      </div>

      <div className="grid auto-rows-[22rem] gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card
          role="region"
          aria-label={t("administrators")}
          className="h-full bg-gradient-to-b from-violet-500/[0.06] to-transparent"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/20 dark:text-violet-300">
                <ShieldCheck className="size-4" />
              </span>
              {t("administrators")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {userList(admins)}
          </CardContent>
        </Card>

        {orgs.map((o) => {
          const members = membersOf(o.id);
          return (
            <Card
              key={o.id}
              role="region"
              aria-label={o.name}
              className="h-full"
            >
              <CardHeader className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="bg-primary/10 text-primary ring-primary/20 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ring-1"
                    aria-hidden
                  >
                    {initials(o.name)}
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="truncate">{o.name}</CardTitle>
                    <p className="text-muted-foreground truncate text-xs">
                      {t("sinceDate", {
                        date: format.dateTime(new Date(o.created_at), {
                          dateStyle: "medium",
                        }),
                      })}
                      {" · "}
                      {t("userCount", { count: members.length })}
                      {" · "}
                      {t("openJobCount", { count: openJobs.get(o.id) ?? 0 })}
                    </p>
                  </div>
                </div>
                <form action={open.bind(null, o.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    {t("openOrganization")}
                    <ArrowRight className="size-4" />
                  </Button>
                </form>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
                {userList(members)}
                <div className="mt-auto">
                  <CreateUserDialog
                    organizations={orgs}
                    organizationId={o.id}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}

        {unassigned.length > 0 && (
          <Card role="region" aria-label={t("unassigned")} className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                  <UserX className="size-4" />
                </span>
                {t("unassigned")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              {userList(unassigned)}
            </CardContent>
          </Card>
        )}
      </div>
      {!orgs.length && (
        <p className="text-muted-foreground">{t("noOrganizations")}</p>
      )}
    </div>
  );
}
