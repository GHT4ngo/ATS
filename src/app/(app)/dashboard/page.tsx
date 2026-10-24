import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Clock,
  Flag,
  Inbox,
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ScoreBadge } from "@/components/assessments/score-badge";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveOrganization, requireUser } from "@/lib/auth/session";
import {
  RANGES,
  STUCK_DAYS,
  buildSeries,
  daysSince,
  isActive,
  parseRange,
  periodCounts,
} from "@/lib/data/dashboard";
import { STAGES, type Stage } from "@/lib/data/schemas";
import { getScope } from "@/lib/data/scope";
import { PHASE_STYLE, isMismatch } from "@/lib/phase-style";
import { cn, initials } from "@/lib/utils";

const LIST_LIMIT = 6;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { profile } = await requireUser();
  const org = await getActiveOrganization();
  const t = await getTranslations("Dashboard");
  const s = await getTranslations("Stages");
  const format = await getFormatter();

  const heading = (
    <h1 className="text-2xl font-semibold tracking-tight">
      {t("welcome", { name: profile.full_name || profile.email || "" })}
    </h1>
  );

  if (!org) {
    return (
      <div className="mx-auto grid w-full max-w-7xl gap-3">
        {heading}
        <p className="text-muted-foreground">{t("pickOrganization")}</p>
        <Link
          href="/admin/customers"
          className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
        >
          {t("toCustomers")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  const range = parseRange((await searchParams).range);
  const now = Date.now();
  const since = new Date(now - 2 * range * 86_400_000 - 86_400_000);
  const scope = await getScope();

  const [
    { data: jobs },
    { data: apps },
    { data: candidates },
    { data: scores },
    { data: moves },
    { data: members },
  ] = await Promise.all([
    scope.supabase
      .from("jobs")
      .select("id, title, status")
      .eq("organization_id", scope.orgId),
    scope.supabase
      .from("applications")
      .select(
        "id, candidate_id, job_id, stage, stage_changed_at, created_at, starred, flagged, mismatch",
      )
      .eq("organization_id", scope.orgId),
    scope.supabase
      .from("candidates")
      .select("id, full_name, cv_path")
      .eq("organization_id", scope.orgId),
    scope.supabase
      .from("latest_cv_assessments")
      .select("candidate_id, job_id, score")
      .eq("organization_id", scope.orgId),
    scope.supabase
      .from("activity_log")
      .select("actor_id, entity_id, payload, created_at")
      .eq("organization_id", scope.orgId)
      .eq("action", "moved")
      .gte("created_at", since.toISOString()),
    scope.supabase
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("organization_id", scope.orgId)
      .order("full_name"),
  ]);

  const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const cand = new Map((candidates ?? []).map((c) => [c.id, c]));
  const score = new Map(
    (scores ?? []).map((a) => [`${a.candidate_id}:${a.job_id}`, a.score]),
  );
  const allApps = (apps ?? []).filter((a) => cand.has(a.candidate_id));
  const moveList = (moves ?? []).map((m) => ({
    at: m.created_at,
    to: String((m.payload as Record<string, unknown>)?.to ?? ""),
    actor: m.actor_id,
    app: m.entity_id,
  }));

  // Headline numbers
  const openJobs = (jobs ?? []).filter((j) => j.status === "open").length;
  const activeCandidates = new Set(
    allApps.filter((a) => isActive(a.stage)).map((a) => a.candidate_id),
  ).size;
  const newApps = periodCounts(
    range,
    now,
    allApps.map((a) => a.created_at),
  );
  const hireMoves = moveList.filter((m) => m.to === "hired");
  const hires = periodCounts(
    range,
    now,
    hireMoves.map((m) => m.at),
  );
  const created = new Map(allApps.map((a) => [a.id, a.created_at]));
  const hireDays = hireMoves
    .filter(
      (m) => new Date(m.at).getTime() >= hires.start && created.has(m.app),
    )
    .map((m) => daysSince(created.get(m.app)!, new Date(m.at).getTime()));
  const avgDaysToHire = hireDays.length
    ? Math.round(hireDays.reduce((a, b) => a + b, 0) / hireDays.length)
    : null;

  // Chart
  const buckets = buildSeries(
    range,
    now,
    allApps.map((a) => a.created_at),
    moveList,
  );
  const weekly = range === 90;
  const labels = buckets.map((b) =>
    format.dateTime(new Date(b.start), { day: "numeric", month: "short" }),
  );
  const longLabels = buckets.map((b) =>
    weekly
      ? t("weekOf", {
          date: format.dateTime(new Date(b.start), {
            day: "numeric",
            month: "long",
          }),
        })
      : format.dateTime(new Date(b.start), {
          weekday: "short",
          day: "numeric",
          month: "long",
        }),
  );

  // Funnel: where every application is right now
  const perPhase = Object.fromEntries(STAGES.map((st) => [st, 0])) as Record<
    Stage,
    number
  >;
  for (const a of allApps) perPhase[a.stage] += 1;
  const funnelMax = Math.max(1, ...Object.values(perPhase));

  // Lists
  type Row = (typeof allApps)[number] & {
    name: string;
    job: string;
    days: number;
    score: number | null;
  };
  const rows: Row[] = allApps.map((a) => ({
    ...a,
    name: cand.get(a.candidate_id)!.full_name,
    job: jobTitle.get(a.job_id) ?? "",
    days: daysSince(a.stage_changed_at, now),
    score: score.get(`${a.candidate_id}:${a.job_id}`) ?? null,
  }));
  const active = rows.filter((r) => isActive(r.stage));
  const attention = active
    .map((r) => ({
      row: r,
      reasons: [
        r.flagged && "flagged",
        r.days > STUCK_DAYS && "stuck",
        r.score === null &&
          cand.get(r.candidate_id)?.cv_path &&
          (r.stage === "applied" || r.stage === "screening") &&
          "unassessed",
      ].filter(Boolean) as ("flagged" | "stuck" | "unassessed")[],
    }))
    .filter((x) => x.reasons.length)
    .sort(
      (a, b) =>
        Number(b.row.flagged) - Number(a.row.flagged) ||
        b.row.days - a.row.days,
    );
  const standouts = active
    .filter(
      (r) =>
        r.starred ||
        (r.score !== null && r.score >= 85 && !isMismatch(r.mismatch, r.score)),
    )
    .sort(
      (a, b) =>
        Number(b.starred) - Number(a.starred) ||
        (b.score ?? 0) - (a.score ?? 0),
    );

  const movesBy = new Map<string, number>();
  for (const m of moveList)
    if (m.actor && new Date(m.at).getTime() >= newApps.start)
      movesBy.set(m.actor, (movesBy.get(m.actor) ?? 0) + 1);

  const href = (r: Row) => `/pipeline?candidate=${r.candidate_id}`;
  const rangeLabel = t("rangeDays", { days: range });

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          {heading}
          <p className="text-muted-foreground">{org.name}</p>
        </div>
        <nav
          aria-label={t("range")}
          className="bg-muted inline-flex rounded-lg p-1 text-sm"
        >
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard?range=${r}`}
              scroll={false}
              aria-current={r === range ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                r === range
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("rangeShort", { days: r })}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          href="/jobs"
          icon={Briefcase}
          tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          label={t("openJobs")}
          value={openJobs}
        />
        <Stat
          href="/pipeline"
          icon={Users}
          tone="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          label={t("activeCandidates")}
          value={activeCandidates}
        />
        <Stat
          href="/candidates"
          icon={Inbox}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          label={t("newApplications")}
          value={newApps.current}
          delta={{ ...newApps, label: t("vsPrevious", { days: range }) }}
        />
        <Stat
          href="/candidates?phase=hired"
          icon={Trophy}
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          label={t("hires")}
          value={hires.current}
          delta={{ ...hires, label: t("vsPrevious", { days: range }) }}
          note={
            avgDaysToHire !== null
              ? t("avgDaysToHire", { days: avgDaysToHire })
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("activity")}</CardTitle>
            <p className="text-muted-foreground text-sm">{rangeLabel}</p>
          </CardHeader>
          <CardContent>
            <ActivityChart
              caption={t("activityCaption", { days: range })}
              labels={labels}
              longLabels={longLabels}
              series={[
                {
                  key: "applications",
                  label: t("seriesApplications"),
                  color: "var(--chart-1)",
                  values: buckets.map((b) => b.applications),
                },
                {
                  key: "hires",
                  label: t("seriesHires"),
                  color: "var(--chart-2)",
                  values: buckets.map((b) => b.hires),
                },
                {
                  key: "interviews",
                  label: t("seriesInterviews"),
                  color: "var(--chart-3)",
                  values: buckets.map((b) => b.interviews),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("funnel")}</CardTitle>
            <p className="text-muted-foreground text-sm">{t("funnelNote")}</p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1">
              {STAGES.map((st) => (
                <li key={st}>
                  <Link
                    href={`/candidates?phase=${st}`}
                    className="hover:bg-muted grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          PHASE_STYLE[st].dot,
                        )}
                        aria-hidden
                      />
                      {s(st)}
                    </span>
                    <span className="bg-muted h-2.5 overflow-hidden rounded-full">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          PHASE_STYLE[st].dot,
                        )}
                        style={{
                          width: `${(perPhase[st] / funnelMax) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="text-right font-medium tabular-nums">
                      {perPhase[st]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              {t("attention")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length ? (
              <ul className="grid gap-1">
                {attention.slice(0, LIST_LIMIT).map(({ row, reasons }) => (
                  <li key={row.id}>
                    <PersonLink href={href(row)} row={row} phase={s(row.stage)}>
                      {reasons.map((r) => (
                        <Reason
                          key={r}
                          kind={r}
                          label={t(`reason.${r}`, { days: row.days })}
                        />
                      ))}
                    </PersonLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("attentionEmpty")}
              </p>
            )}
            {attention.length > LIST_LIMIT && (
              <p className="text-muted-foreground mt-2 text-xs">
                {t("andMore", { count: attention.length - LIST_LIMIT })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {t("standouts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {standouts.length ? (
              <ul className="grid gap-1">
                {standouts.slice(0, LIST_LIMIT).map((row) => (
                  <li key={row.id}>
                    <PersonLink href={href(row)} row={row} phase={s(row.stage)}>
                      {row.starred && (
                        <Star
                          className="size-3.5 fill-amber-400 text-amber-400"
                          aria-label={t("starred")}
                        />
                      )}
                      {row.score !== null && (
                        <ScoreBadge
                          score={row.score}
                          label={t("score", { score: row.score })}
                        />
                      )}
                    </PersonLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("standoutsEmpty")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-violet-500" />
              {t("team")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("teamNote", { days: range })}
            </p>
          </CardHeader>
          <CardContent>
            {members?.length ? (
              <ul className="grid gap-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                      aria-hidden
                    >
                      {initials(m.full_name || m.email || "")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {m.full_name || m.email}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {m.is_active ? m.email : t("inactive")}
                      </span>
                    </span>
                    <span
                      className="text-muted-foreground text-xs tabular-nums"
                      title={t("moves", { count: movesBy.get(m.id) ?? 0 })}
                    >
                      {t("moves", { count: movesBy.get(m.id) ?? 0 })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("teamEmpty")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  href,
  icon: Icon,
  tone,
  label,
  value,
  delta,
  note,
}: {
  href: string;
  icon: LucideIcon;
  tone: string;
  label: string;
  value: number;
  delta?: { current: number; previous: number; label: string };
  note?: string;
}) {
  const diff = delta ? delta.current - delta.previous : 0;
  const Arrow = diff >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Link
      href={href}
      className="group bg-card focus-visible:ring-ring flex items-start gap-4 rounded-xl border p-4 shadow-xs transition-shadow outline-none hover:shadow-md focus-visible:ring-2"
    >
      <span className={cn("rounded-lg p-2.5", tone)}>
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {delta && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              diff > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : diff < 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground",
            )}
          >
            <Arrow className="size-3.5" />
            {diff > 0 ? `+${diff}` : diff} {delta.label}
          </span>
        )}
        {note && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-3.5" />
            {note}
          </span>
        )}
      </span>
      <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function PersonLink({
  href,
  row,
  phase,
  children,
}: {
  href: string;
  row: { name: string; job: string; stage: Stage };
  phase: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-muted flex items-center gap-3 rounded-md px-2 py-1.5 text-sm"
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          PHASE_STYLE[row.stage].dot,
        )}
        title={phase}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{row.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {row.job} · {phase}
        </span>
      </span>
      <span className="flex max-w-[55%] shrink-0 flex-wrap items-center justify-end gap-1">
        {children}
      </span>
    </Link>
  );
}

const REASON: Record<string, { icon: LucideIcon; tone: string }> = {
  flagged: {
    icon: Flag,
    tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
  stuck: {
    icon: Clock,
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  unassessed: {
    icon: Sparkles,
    tone: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
};

function Reason({ kind, label }: { kind: string; label: string }) {
  const { icon: Icon, tone } = REASON[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        tone,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
