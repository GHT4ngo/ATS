import { getTranslations } from "next-intl/server";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const org = await getActiveOrganization();
  const t = await getTranslations("Dashboard");

  return (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("welcome", { name: profile.full_name || profile.email || "" })}
      </h1>
      <p className="text-muted-foreground">
        {org ? t("comingSoon") : t("pickOrganization")}
      </p>
    </div>
  );
}
