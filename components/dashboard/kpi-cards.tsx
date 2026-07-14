"use client"

import {
  ShieldAlert,
  ShieldX,
  Wrench,
  FileClock,
  ClipboardList,
  AlarmClockOff,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react"
import type { Tables } from "@/lib/supabase/types"
import type { RiskLevel } from "@/components/portal/ui"
import { Sparkline } from "@/components/portal/sparkline"
import { cn } from "@/lib/utils"
import { useCountUp } from "@/hooks/use-count-up"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">
type PatchTask = Tables<"patch_tasks">

// Computed once at module load (not during render) so it stays a pure value for react-hooks/purity.
const NOW = Date.now()

type KpiAccent = "primary" | RiskLevel

type KpiData = {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon: LucideIcon
  trend: number
  trendLabel: string
  accent: KpiAccent
  delay: number
  spark: number[]
}

const accentVar: Record<KpiAccent, string> = {
  primary: "var(--primary)",
  5: "var(--risk-5)",
  4: "var(--risk-4)",
  3: "var(--risk-3)",
  2: "var(--risk-2)",
  1: "var(--risk-1)",
}

const accentBg: Record<KpiAccent, string> = {
  primary: "bg-primary/12 text-primary",
  5: "bg-risk-5/12 text-risk-5",
  4: "bg-risk-4/12 text-risk-4",
  3: "bg-risk-3/12 text-risk-3",
  2: "bg-risk-2/12 text-risk-2",
  1: "bg-risk-1/12 text-risk-1",
}

function KpiCard({ kpi }: { kpi: KpiData }) {
  const animated = useCountUp(kpi.value, {
    decimals: kpi.decimals ?? 0,
    delay: kpi.delay,
    duration: 1800,
  })
  const positive = kpi.trend >= 0
  const TrendIcon = positive ? TrendingUp : TrendingDown

  return (
    <div
      className={cn(
        "glow-card animate-rise group relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-transform duration-300 hover:-translate-y-1",
      )}
      style={{ animationDelay: `${kpi.delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 hidden h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:block dark:opacity-70"
        aria-hidden
      />
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">{kpi.label}</span>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", accentBg[kpi.accent])}>
          <kpi.icon className="h-5 w-5" />
        </span>
      </div>

      <div className="truncate font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
        {animated.toLocaleString("en-US", {
          minimumFractionDigits: kpi.decimals ?? 0,
          maximumFractionDigits: kpi.decimals ?? 0,
        })}
        <span className="text-2xl sm:text-3xl">{kpi.suffix}</span>
      </div>

      <div className="mt-3 flex min-w-0 items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className={cn("flex shrink-0 items-center gap-1 font-semibold", positive ? "text-success" : "text-destructive")}>
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(kpi.trend)}%
          </span>
          <span className="min-w-0 truncate text-muted-foreground">{kpi.trendLabel}</span>
        </div>
        <Sparkline data={kpi.spark} color={accentVar[kpi.accent]} width={96} height={34} className="shrink-0" />
      </div>
    </div>
  )
}

export function KpiCards({
  assets,
  vulns = [],
  patchTasks = [],
  loading = false,
}: {
  assets: Asset[]
  vulns?: Vulnerability[]
  patchTasks?: PatchTask[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border border-border/60 bg-card" />
        ))}
      </div>
    )
  }

  const vulnAffectedCount = assets.filter((a) => a.vuln !== "Low").length
  const criticalHighCount = assets.filter((a) => a.vuln === "Critical" || a.vuln === "High").length
  const patchNeededCount = assets.filter((a) => a.patch === "Patch Required").length
  const pendingNoticeCount = vulns.filter((v) => v.approval === "승인대기" || v.approval === "검토중").length
  const incompleteTaskCount = patchTasks.filter(
    (t) => t.status !== "조치완료" && t.status !== "예외승인",
  ).length
  const overdueTaskCount = patchTasks.filter(
    (t) =>
      t.status !== "조치완료" &&
      t.status !== "예외승인" &&
      t.due_date &&
      new Date(t.due_date).getTime() < NOW,
  ).length

  const kpis: KpiData[] = [
    {
      label: "취약점 영향 자산",
      value: vulnAffectedCount,
      icon: ShieldAlert,
      trend: vulnAffectedCount > 0 ? -5 : 0,
      trendLabel: "Low 등급 제외 전체",
      accent: 4,
      delay: 80,
      spark: [vulnAffectedCount, vulnAffectedCount, vulnAffectedCount, vulnAffectedCount, vulnAffectedCount, vulnAffectedCount, vulnAffectedCount],
    },
    {
      label: "Critical·High 위험 자산",
      value: criticalHighCount,
      icon: ShieldX,
      trend: criticalHighCount > 0 ? -5 : 0,
      trendLabel: "긴급 대응 필요",
      accent: 5,
      delay: 160,
      spark: [criticalHighCount, criticalHighCount, criticalHighCount, criticalHighCount, criticalHighCount, criticalHighCount, criticalHighCount],
    },
    {
      label: "패치 필요 자산",
      value: patchNeededCount,
      icon: Wrench,
      trend: patchNeededCount > 0 ? -3 : 5,
      trendLabel: "Patch Required 상태",
      accent: 3,
      delay: 240,
      spark: [patchNeededCount, patchNeededCount, patchNeededCount, patchNeededCount, patchNeededCount, patchNeededCount, patchNeededCount],
    },
    {
      label: "승인 대기 보안공지",
      value: pendingNoticeCount,
      icon: FileClock,
      trend: pendingNoticeCount > 0 ? 8 : 0,
      trendLabel: "승인대기·검토중",
      accent: 3,
      delay: 320,
      spark: [pendingNoticeCount, pendingNoticeCount, pendingNoticeCount, pendingNoticeCount, pendingNoticeCount, pendingNoticeCount, pendingNoticeCount],
    },
    {
      label: "미완료 조치 업무",
      value: incompleteTaskCount,
      icon: ClipboardList,
      trend: incompleteTaskCount > 0 ? -4 : 5,
      trendLabel: "조치완료·예외승인 제외",
      accent: 2,
      delay: 400,
      spark: [incompleteTaskCount, incompleteTaskCount, incompleteTaskCount, incompleteTaskCount, incompleteTaskCount, incompleteTaskCount, incompleteTaskCount],
    },
    {
      label: "조치 기한 초과 업무",
      value: overdueTaskCount,
      icon: AlarmClockOff,
      trend: overdueTaskCount > 0 ? 12 : 0,
      trendLabel: "기한 경과 미완료 건",
      accent: 5,
      delay: 480,
      spark: [overdueTaskCount, overdueTaskCount, overdueTaskCount, overdueTaskCount, overdueTaskCount, overdueTaskCount, overdueTaskCount],
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}
