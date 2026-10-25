import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  Briefcase,
  Clock,
  Inbox,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ScoreBadge } from "@/components/assessments/score-badge";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { Signal } from "@/components/signals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getActiveOrganization,
  getViewMode,
  requireUser,
} from "@/lib/auth/session";
import {
  RANGES,
  STUCK_DAYS,
  buildSeries,
  daysSince,
  isActive,
  parseRange,
  periodCounts,
  TIME_ZONE,
} from "@/lib/data/dashboard";
import { hiresByJob, isHiring } from "@/lib/data/openings";
import { allRows } from "@/lib/data/paging";
import { latestScores, scoreKey } from "@/lib/data/scores";
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
  const { isAdmin } = await getViewMode();
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
        {isAdmin && (
          <Link
            href="/admin/users"
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            {t("toUsers")}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    );
  }

  const range = parseRange((await searchParams).range);
  const now = Date.now();
  const since = new Date(periodCounts(range, now, TIME_ZONE, []).prevStart);
  const scope = await getScope();

  const [
    { data: jobs },
    { data: apps },
    { data: candidates },
    score,
    { data: moves },
    { data: members },
  ] = await Promise.all([
    allRows((from, to) =>
      scope.supabase
        .from("jobs")
        .select("id, title, status, openings")
        .eq("organization_id", scope.orgId)
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      scope.supabase
        .from("applications")
        .select(
          "id, candidate_id, job_id, stage, stage_changed_at, created_at, starred, flagged, mismatch",
        )
        .eq("organization_id", scope.orgId)
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      scope.supabase
        .from("candidates")
        .select("id, full_name, cv_path")
        .eq("organization_id", scope.orgId)
        .order("id")
        .range(from, to),
    ),
    latestScores(scope),
    allRows((from, to) =>
      scope.supabase
        .from("activity_log")
        .select("actor_id, entity_id, payload, created_at")
        .eq("organization_id", scope.orgId)
        .eq("action", "moved")
        .gte("created_at", since.toISOString())
        .order("id")
        .range(from, to),
    ),
    scope.supabase
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("organization_id", scope.orgId)
      .order("full_name"),
  ]);

  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));
  const cand = new Map(candidates.map((c) => [c.id, c]));
  const allApps = apps.filter((a) => cand.has(a.candidate_id));
  // Moves into the interview phase; a move between two interview stages of a
  // job is not a new interview.
  const interviewMoves = moves.filter((m) => {
    const p = (m.payload ?? {}) as Record<string, unknown>;
    return p.to === "interview" && p.from !== "interview";
  });
  // A hire is an application that is hired now, dated by its move to hired,
  // so a mistaken move to hired and back does not count.
  const hired = allApps.filter((a) => a.stage === "hired");

  // Headline numbers
  // Filled jobs are done hiring, even while their status is still open.
  const hiresPerJob = hiresByJob(allApps);
  const openJobs = jobs.filter((j) => isHiring(j, hiresPerJob)).length;
  const activeCandidates = new Set(
    allApps.filter((a) => isActive(a.stage)).map((a) => a.candidate_id),
  ).size;
  const newApps = periodCounts(
    range,
    now,
    TIME_ZONE,
    allApps.map((a) => a.created_at),
  );
  const hires = periodCounts(
    range,
    now,
    TIME_ZONE,
    hired.map((a) => a.stage_changed_at),
  );
  const hireDays = hired
    .filter((a) => new Date(a.stage_changed_at).getTime() >= hires.start)
    .map((a) =>
      daysSince(a.created_at, new Date(a.stage_changed_at).getTime()),
    );
  const avgDaysToHire = hireDays.length
    ? Math.round(hireDays.reduce((a, b) => a + b, 0) / hireDays.length)
    : null;

  // Chart
  const buckets = buildSeries(range, now, TIME_ZONE, {
    applications: allApps.map((a) => a.created_at),
    interviews: interviewMoves.map((m) => m.created_at),
    hires: hired.map((a) => a.stage_changed_at),
  });
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
    score: score.get(scoreKey(a.candidate_id, a.job_id)) ?? null,
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
  for (const m of moves)
    if (m.actor_id && new Date(m.created_at).getTime() >= newApps.start)
      movesBy.set(m.actor_id, (movesBy.get(m.actor_id) ?? 0) + 1);

  const href = (r: Row) => `/pipeline?candidate=${r.candidate_id}`;
  const rangeLabel = t("rangeDays", { days: range });
  const vs = t("vsPrevious", { days: range });

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          {heading}
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {org.name}
          </p>
        </div>
        <nav
          aria-label={t("range")}
          className="bg-muted/60 ring-foreground/5 inline-flex rounded-full p-1 text-sm ring-1"
        >
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/dashboard?range=${r}`}
              scroll={false}
              aria-current={r === range ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                r === range
                  ? "bg-background text-foreground elevated font-medium"
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
          index={0}
          href="/jobs"
          icon={Briefcase}
          hue="blue"
          label={t("openJobs")}
          value={openJobs}
        />
        <Stat
          index={1}
          href="/pipeline"
          icon={Users}
          hue="violet"
          label={t("activeCandidates")}
          value={activeCandidates}
        />
        <Stat
          index={2}
          href="/candidates"
          icon={Inbox}
          hue="sky"
          label={t("newApplications")}
          value={newApps.current}
          delta={{ ...newApps, label: vs }}
        />
        <Stat
          index={3}
          href="/candidates?phase=hired"
          icon={Trophy}
          hue="emerald"
          label={t("hires")}
          value={hires.current}
          delta={{ ...hires, label: vs }}
          note={
            avgDaysToHire !== null
              ? t("avgDaysToHire", { days: avgDaysToHire })
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={cn("min-w-0 lg:col-span-2", RISE)} style={delay(4)}>
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

        <Card className={RISE} style={delay(5)}>
          <CardHeader>
            <CardTitle>{t("funnel")}</CardTitle>
            <p className="text-muted-foreground text-sm">{t("funnelNote")}</p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1">
              {STAGES.map((st, i) => (
                <li key={st}>
                  <Link
                    href={`/candidates?phase=${st}`}
                    className="hover:bg-muted/50 grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors"
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
                    <span className="bg-muted/70 h-2 overflow-hidden rounded-full">
                      <span
                        className={cn(
                          "bar-grow block h-full rounded-full opacity-70",
                          PHASE_STYLE[st].dot,
                        )}
                        style={{
                          width: `${(perPhase[st] / funnelMax) * 100}%`,
                          animationDelay: `${300 + i * 70}ms`,
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
        <Card className={RISE} style={delay(6)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tint hue="amber" icon={AlertTriangle} />
              {t("attention")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length ? (
              <ul className="grid gap-0.5">
                {attention.slice(0, LIST_LIMIT).map(({ row, reasons }) => (
                  <li key={row.id}>
                    <PersonLink href={href(row)} row={row} phase={s(row.stage)}>
                      {reasons.includes("flagged") && <Signal kind="flagged" />}
                      {reasons.includes("unassessed") && (
                        <Signal kind="unassessed" />
                      )}
                      <Signal
                        kind={reasons.includes("stuck") ? "stuck" : "days"}
                        days={row.days}
                      />
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
              <p className="text-muted-foreground mt-2 px-2 text-xs">
                {t("andMore", { count: attention.length - LIST_LIMIT })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={RISE} style={delay(7)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tint hue="amber" icon={Star} />
              {t("standouts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {standouts.length ? (
              <ul className="grid gap-0.5">
                {standouts.slice(0, LIST_LIMIT).map((row) => (
                  <li key={row.id}>
                    <PersonLink href={href(row)} row={row} phase={s(row.stage)}>
                      {row.starred && <Signal kind="starred" />}
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

        <Card className={RISE} style={delay(8)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tint hue="violet" icon={Users} />
              {t("team")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("teamNote", { days: range })}
            </p>
          </CardHeader>
          <CardContent>
            {members?.length ? (
              <ul className="grid gap-2">
                {members.map((m) => {
                  const count = movesBy.get(m.id) ?? 0;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 px-2 text-sm",
                        !m.is_active && "opacity-60",
                      )}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-semibold text-violet-700 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300"
                        aria-hidden
                      >
                        {initials(m.full_name || m.email || "")}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {m.full_name || m.email}
                      </span>
                      <span
                        className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums"
                        title={t("moves", { count })}
                        aria-label={t("moves", { count })}
                      >
                        <ArrowRightLeft className="size-3.5" aria-hidden />
                        {count}
                      </span>
                    </li>
                  );
                })}
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

/** Cards rise into place one after another; off with reduced motion. */
const RISE =
  "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 motion-reduce:animate-none";
const delay = (i: number) => ({ animationDelay: `${i * 60}ms` });

type Hue = "blue" | "violet" | "sky" | "emerald" | "amber";

const HUE: Record<Hue, { chip: string; glow: string }> = {
  blue: {
    chip: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-300",
    glow: "from-blue-500/[0.07]",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300",
    glow: "from-violet-500/[0.07]",
  },
  sky: {
    chip: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300",
    glow: "from-sky-500/[0.07]",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
    glow: "from-emerald-500/[0.07]",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300",
    glow: "from-amber-500/[0.07]",
  },
};

function Tint({ hue, icon: Icon }: { hue: Hue; icon: LucideIcon }) {
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-lg ring-1 ring-inset",
        HUE[hue].chip,
      )}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

function Stat({
  index,
  href,
  icon: Icon,
  hue,
  label,
  value,
  delta,
  note,
}: {
  index: number;
  href: string;
  icon: LucideIcon;
  hue: Hue;
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
      style={delay(index)}
      className={cn(
        "group bg-card ring-foreground/[0.07] elevated hover:elevated-hover focus-visible:ring-ring relative flex items-start gap-4 overflow-hidden rounded-xl bg-gradient-to-br to-transparent to-60% p-4 ring-1 transition-[box-shadow,translate] outline-none hover:-translate-y-0.5 focus-visible:ring-2 motion-reduce:hover:translate-y-0",
        HUE[hue].glow,
        RISE,
      )}
    >
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {delta && (
            <span
              title={delta.label}
              aria-label={`${diff > 0 ? `+${diff}` : diff} ${delta.label}`}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 text-xs leading-5 font-medium tabular-nums ring-1 ring-inset",
                diff > 0
                  ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
                  : diff < 0
                    ? "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300"
                    : "bg-muted text-muted-foreground ring-foreground/5",
              )}
            >
              <Arrow className="size-3" aria-hidden />
              {diff > 0 ? `+${diff}` : diff}
            </span>
          )}
        </span>
        {note && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-3" aria-hidden />
            {note}
          </span>
        )}
      </span>
      <span
        className={cn(
          "rounded-xl p-2.5 ring-1 transition-transform ring-inset group-hover:scale-105 motion-reduce:group-hover:scale-100",
          HUE[hue].chip,
        )}
      >
        <Icon className="size-5" />
      </span>
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
      className="hover:bg-muted/50 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          PHASE_STYLE[row.stage].soft,
        )}
        aria-hidden
      >
        {initials(row.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{row.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {row.job} · {phase}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">{children}</span>
    </Link>
  );
}
