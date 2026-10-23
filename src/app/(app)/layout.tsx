import { getTranslations } from "next-intl/server";
import { logout } from "@/app/actions/auth";
import { setActingOrganization } from "@/app/actions/admin";
import { NavLinks } from "@/components/app/nav-links";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { Button } from "@/components/ui/button";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";
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
    { href: "/dashboard", label: t("dashboard") },
    { href: "/team", label: t("team") },
    { href: "/settings", label: t("settings") },
    ...(isAdmin
      ? [
          { href: "/admin/organizations", label: t("organizations") },
          { href: "/admin/users", label: t("users") },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">{c("appName")}</span>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-3">
            {isAdmin && (
              <OrgSwitcher
                organizations={organizations}
                activeId={activeOrg?.id ?? null}
              />
            )}
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {profile.full_name || profile.email}
            </span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
        {isAdmin && activeOrg && (
          <div className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5 text-sm">
              <span>{t("viewingAs", { name: activeOrg.name })}</span>
              <form action={setActingOrganization.bind(null, "")}>
                <button type="submit" className="underline">
                  {t("exitViewing")}
                </button>
              </form>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
