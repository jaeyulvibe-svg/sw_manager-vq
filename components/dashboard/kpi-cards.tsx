"use client"

import {
  ShieldAlert,
  ShieldX,
  Wrench,
  ClipboardList,
  AlarmClockOff,
  type LucideIcon,
} from "lucide-react"
import type { Tables } from "@/lib/supabase/types"
import type { RiskLevel } from "@/components/portal/ui"
import type { ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"
import { useCountUp } from "@/hooks/use-count-up"
import { useClickableCard } from "@/hooks/use-clickable-card"

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
  subLabel?: string
  accent: KpiAccent
  delay: number
  onClick?: () => void
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
  const clickable = useClickableCard(kpi.onClick)

  return (
    <div
      role={clickable.role}
      tabIndex={clickable.tabIndex}
      onClick={clickable.onClick}
      onKeyDown={clickable.onKeyDown}
      className={cn(
        "glow-card animate-rise group relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-transform duration-300 hover:-translate-y-1",
        clickable.clickableClassName,
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

      {kpi.subLabel ? (
        <p className="mt-3 truncate text-xs text-muted-foreground">{kpi.subLabel}</p>
      ) : null}
    </div>
  )
}

export function KpiCards({
  assets,
  vulns = [],
  patchTasks = [],
  loading = false,
  onNavigate,
}: {
  assets: Asset[]
  vulns?: Vulnerability[]
  patchTasks?: PatchTask[]
  loading?: boolean
  onNavigate?: (view: ViewKey) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border border-border/60 bg-card" />
        ))}
      </div>
    )
  }

  const totalAssets = assets.length
  const vulnAffectedCount = assets.filter((a) => a.vuln !== "Low").length
  const criticalCount = assets.filter((a) => a.vuln === "Critical").length
  const highCount = assets.filter((a) => a.vuln === "High").length
  const patchNeededCount = assets.filter((a) => a.patch === "Patch Required").length
  const patchAvailableCount = assets.filter((a) => a.patch === "Patch Available").length

  const incompleteTasks = patchTasks.filter(
    (t) => t.status !== "조치완료" && t.status !== "예외승인",
  )
  const inProgressTasks = incompleteTasks.filter(
    (t) => t.status === "조치예정" || t.status === "조치지연",
  ).length
  const waitingTasks = incompleteTasks.filter((t) => t.status === "배정됨").length

  const overdueTasks = incompleteTasks.filter(
    (t) => t.due_date && new Date(t.due_date).getTime() < NOW,
  )
  const maxOverdueDays =
    overdueTasks.length > 0
      ? Math.max(
          ...overdueTasks.map((t) => Math.floor((NOW - new Date(t.due_date as string).getTime()) / 86400000)),
        )
      : 0

  const kpis: KpiData[] = [
    {
      label: "취약점 영향 자산",
      value: vulnAffectedCount,
      icon: ShieldAlert,
      subLabel: totalAssets > 0 ? `전체 자산 중 ${vulnAffectedCount}개` : undefined,
      accent: 4,
      delay: 80,
      onClick: onNavigate ? () => onNavigate("assets") : undefined,
    },
    {
      label: "Critical·High 위험 자산",
      value: criticalCount + highCount,
      icon: ShieldX,
      subLabel: `Critical ${criticalCount} · High ${highCount}`,
      accent: 5,
      delay: 160,
      onClick: onNavigate ? () => onNavigate("assets") : undefined,
    },
    {
      label: "패치 필요 자산",
      value: patchNeededCount,
      icon: Wrench,
      subLabel: `패치 필요 ${patchNeededCount} · 패치 가능 ${patchAvailableCount}`,
      accent: 3,
      delay: 240,
      onClick: onNavigate ? () => onNavigate("patch") : undefined,
    },
    {
      label: "미완료 조치 업무",
      value: incompleteTasks.length,
      icon: ClipboardList,
      subLabel: `진행 중 ${inProgressTasks} · 배정 대기 ${waitingTasks}`,
      accent: 2,
      delay: 320,
      onClick: onNavigate ? () => onNavigate("patch-tasks") : undefined,
    },
    {
      label: "조치 기한 초과 업무",
      value: overdueTasks.length,
      icon: AlarmClockOff,
      subLabel: overdueTasks.length > 0 ? `최장 지연 ${maxOverdueDays}일` : undefined,
      accent: 5,
      delay: 400,
      onClick: onNavigate ? () => onNavigate("patch-tasks") : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}
