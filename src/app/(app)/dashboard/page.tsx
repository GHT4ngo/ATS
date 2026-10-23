import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";
import { STAGES } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const org = await getActiveOrganization();
  const t = await getTranslations("Dashboard");
  const s = await getTranslations("Stages");

  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">
      {t("welcome", { name: profile.full_name || profile.email || "" })}
    </h1>
  );

  if (!org) {
    return (
      <div className="grid gap-2">
        {heading}
        <p className="text-muted-foreground">{t("pickOrganization")}</p>
      </div>
    );
  }

  const scope = await getScope();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ count: openJobs }, { data: apps }] = await Promise.all([
    scope.supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.orgId)
      .eq("status", "open"),
    scope.applications().select("candidate_id, stage, stage_changed_at"),
  ]);

  const perStage = Object.fromEntries(STAGES.map((st) => [st, 0]));
  const active = new Set<string>();
  let hiresThisMonth = 0;
  for (const a of apps ?? []) {
    perStage[a.stage] += 1;
    if (a.stage !== "hired" && a.stage !== "rejected")
      active.add(a.candidate_id);
    if (a.stage === "hired" && new Date(a.stage_changed_at) >= monthStart)
      hiresThisMonth += 1;
  }
  const max = Math.max(1, ...Object.values(perStage));

  const stats = [
    { label: t("openJobs"), value: openJobs ?? 0 },
    { label: t("activeCandidates"), value: active.size },
    { label: t("hiresThisMonth"), value: hiresThisMonth },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        {heading}
        <p className="text-muted-foreground">{org.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-sm font-normal">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">
              {stat.value}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("funnel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {STAGES.map((st) => (
              <li
                key={st}
                className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm"
              >
                <span>{s(st)}</span>
                <div className="bg-muted h-3 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${(perStage[st] / max) * 100}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{perStage[st]}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
