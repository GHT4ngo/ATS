import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/actions/auth";
import { setActingOrganization } from "@/app/actions/admin";
import { AppShell } from "@/components/app/app-shell";
import { LanguageToggle, ThemeToggle } from "@/components/app/preferences";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { Button } from "@/components/ui/button";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();
  const t = await getTranslations("Nav");
  const c = await getTranslations("Common");
  const isAdmin = profile.role === "admin";
  const activeOrg = await getActiveOrganization();

  let organizations: { id: string; name: string }[] = [];
  if (isAdmin) {
    const supabase = await createClient();
    organizations =
      (await supabase.from("organizations").select("id, name").order("name"))
        .data ?? [];
  }

  const links = [
    { href: "/dashboard", icon: "dashboard", label: t("dashboard") },
    { href: "/pipeline", icon: "pipeline", label: t("pipeline") },
    { href: "/jobs", icon: "jobs", label: t("jobs") },
    { href: "/candidates", icon: "candidates", label: t("candidates") },
    { href: "/team", icon: "team", label: t("team") },
    { href: "/settings", icon: "settings", label: t("settings") },
    ...(isAdmin
      ? [
          {
            href: "/admin/organizations",
            icon: "organizations",
            label: t("organizations"),
          },
          { href: "/admin/users", icon: "users", label: t("users") },
        ]
      : []),
  ];

  const defaultCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      links={links}
      appName={c("appName")}
      defaultCollapsed={defaultCollapsed}
      assistant={Boolean(activeOrg)}
      banner={
        isAdmin && activeOrg ? (
          <div className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <div className="flex items-center gap-3 px-4 py-1.5 text-sm">
              <span>{t("viewingAs", { name: activeOrg.name })}</span>
              <form action={setActingOrganization.bind(null, "")}>
                <button type="submit" className="underline">
                  {t("exitViewing")}
                </button>
              </form>
            </div>
          </div>
        ) : undefined
      }
      compactFooter={
        <div className="flex flex-col items-center gap-1">
          <ThemeToggle />
          <LanguageToggle />
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label={t("signOut")}
              title={t("signOut")}
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      }
      footer={
        <div className="grid gap-3">
          {isAdmin && (
            <OrgSwitcher
              organizations={organizations}
              activeId={activeOrg?.id ?? null}
            />
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageToggle />
          </div>
          <span className="text-muted-foreground truncate text-sm">
            {profile.full_name || profile.email}
          </span>
          <form action={logout}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full"
            >
              {t("signOut")}
            </Button>
          </form>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
