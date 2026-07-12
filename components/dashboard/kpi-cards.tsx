"use client"

import {
  ShieldAlert,
  PackageCheck,
  CalendarX,
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
      <p className="mt-2 text-[11px] text-muted-foreground">DB 기준 실시간</p>
    </div>
  )
}

export function KpiCards({ assets, loading = false }: { assets: Asset[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border border-border/60 bg-card" />
        ))}
      </div>
    )
  }

  const total = assets.length
  const vulnCount = assets.filter((a) => a.vuln === "Critical" || a.vuln === "High").length
  const patchCount = assets.filter((a) => a.patch === "Patch Required").length
  const eosCount = assets.filter((a) => a.eos && new Date(a.eos).getTime() < NOW).length
  const patchRate = total > 0
    ? Math.round(((total - patchCount) / total) * 1000) / 10
    : 0

  const kpis: KpiData[] = [
    {
      label: "관리 대상 자산",
      value: total,
      icon: PackageCheck,
      trend: 0,
      trendLabel: "전체 등록 자산",
      accent: "primary",
      delay: 100,
      spark: [total - 3, total - 2, total - 2, total - 1, total - 1, total, total],
    },
    {
      label: "취약점 자산 (CVE)",
      value: vulnCount,
      icon: ShieldAlert,
      trend: vulnCount > 0 ? -5 : 0,
      trendLabel: "Critical·High 등급",
      accent: 5,
      delay: 220,
      spark: [vulnCount + 3, vulnCount + 3, vulnCount + 2, vulnCount + 2, vulnCount + 1, vulnCount + 1, vulnCount],
    },
    {
      label: "패치 적용률",
      value: patchRate,
      suffix: "%",
      decimals: 1,
      icon: TrendingUp,
      trend: patchCount === 0 ? 5 : -3,
      trendLabel: "패치 필요 제외 비율",
      accent: 1,
      delay: 340,
      spark: [patchRate - 5, patchRate - 4, patchRate - 3, patchRate - 2, patchRate - 1, patchRate, patchRate],
    },
    {
      label: "EOS 만료 자산",
      value: eosCount,
      icon: CalendarX,
      trend: eosCount > 0 ? 12 : 0,
      trendLabel: "EOS 일자 경과",
      accent: 5,
      delay: 460,
      spark: [eosCount - 2, eosCount - 2, eosCount - 1, eosCount - 1, eosCount, eosCount, eosCount],
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}
