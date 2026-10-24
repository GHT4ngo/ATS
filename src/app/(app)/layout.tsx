import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/actions/auth";
import {
  exitCustomerPreview,
  setActingOrganization,
} from "@/app/actions/admin";
import { AppShell } from "@/components/app/app-shell";
import { DevMenu } from "@/components/app/dev-menu";
import { LanguageToggle, ThemeToggle } from "@/components/app/preferences";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { SettingsDialog } from "@/components/app/settings-dialog";
import { Button } from "@/components/ui/button";
import {
  getActiveOrganization,
  getViewMode,
  requireUser,
} from "@/lib/auth/session";
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
  const activeOrg = await getActiveOrganization();
  const { isAdmin, adminUi, devMode, preview } = await getViewMode();

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
    ...(adminUi
      ? [
          {
            href: "/admin/customers",
            icon: "customers",
            label: t("customers"),
          },
        ]
      : []),
  ];

  const tools = (
    <>
      <ThemeToggle />
      <LanguageToggle />
      <SettingsDialog
        fullName={profile.full_name}
        locale={profile.locale as "sv" | "en"}
        devMode={adminUi ? devMode : undefined}
      />
      {/* Hidden in a preview, which the banner ends. */}
      {devMode && adminUi && (
        <DevMenu
          organizations={organizations}
          previewing={preview ? (activeOrg?.id ?? null) : null}
        />
      )}
    </>
  );

  let banner: React.ReactNode;
  if (preview && activeOrg) {
    banner = (
      <div className="bg-violet-600 text-white dark:bg-violet-900 dark:text-violet-50">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-sm">
          <span className="font-medium">
            {t("previewing", { name: activeOrg.name })}
          </span>
          <span className="opacity-80">{t("previewNote")}</span>
          <form action={exitCustomerPreview} className="ml-auto">
            <button type="submit" className="font-medium underline">
              {t("exitPreview")}
            </button>
          </form>
        </div>
      </div>
    );
  } else if (isAdmin && activeOrg) {
    banner = (
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
    );
  }

  const defaultCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      links={links}
      appName={c("appName")}
      defaultCollapsed={defaultCollapsed}
      assistant={Boolean(activeOrg)}
      banner={banner}
      compactFooter={
        <div className="flex flex-col items-center gap-1">
          {tools}
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
          {adminUi && (
            <OrgSwitcher
              organizations={organizations}
              activeId={activeOrg?.id ?? null}
            />
          )}
          <div className="flex items-center gap-1">{tools}</div>
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
