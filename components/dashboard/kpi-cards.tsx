"use client"

import { useEffect, useState } from "react"
import {
  ShieldAlert,
  PackageCheck,
  CalendarX,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Sparkline } from "@/components/portal/sparkline"
import { cn } from "@/lib/utils"
import { useCountUp } from "@/hooks/use-count-up"

type KpiData = {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon: LucideIcon
  trend: number
  trendLabel: string
  accent: "primary" | "destructive" | "warning" | "success"
  delay: number
  spark: number[]
}

const accentVar: Record<string, string> = {
  primary: "var(--primary)",
  destructive: "var(--destructive)",
  warning: "var(--warning)",
  success: "var(--success)",
}

const accentBg: Record<string, string> = {
  primary: "bg-primary/12 text-primary",
  destructive: "bg-destructive/12 text-destructive",
  warning: "bg-warning/12 text-warning",
  success: "bg-success/12 text-success",
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
        "glow-card animate-rise group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-transform duration-300 hover:-translate-y-1",
      )}
      style={{ animationDelay: `${kpi.delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-70"
        aria-hidden
      />
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accentBg[kpi.accent])}>
          <kpi.icon className="h-5 w-5" />
        </span>
      </div>

      <div className="font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
        {animated.toLocaleString("en-US", {
          minimumFractionDigits: kpi.decimals ?? 0,
          maximumFractionDigits: kpi.decimals ?? 0,
        })}
        <span className="text-2xl sm:text-3xl">{kpi.suffix}</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className={cn("flex items-center gap-1 font-semibold", positive ? "text-success" : "text-destructive")}>
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(kpi.trend)}%
          </span>
          <span className="text-muted-foreground">{kpi.trendLabel}</span>
        </div>
        <Sparkline data={kpi.spark} color={accentVar[kpi.accent]} width={96} height={34} className="shrink-0" />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">DB 기준 실시간</p>
    </div>
  )
}

export function KpiCards() {
  const [kpis, setKpis] = useState<KpiData[]>([])

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      supabase.from("assets").select("*", { count: "exact", head: true }),
      supabase.from("assets").select("vuln").in("vuln", ["Critical", "High"]),
      supabase.from("assets").select("patch").eq("patch", "Patch Required"),
      supabase.from("assets").select("eos").lt("eos", new Date().toISOString()),
    ]).then(([totalRes, vulnRes, patchRes, eosRes]) => {
      const total     = totalRes.count ?? 0
      const vulnCount = vulnRes.data?.length ?? 0
      const patchCount = patchRes.data?.length ?? 0
      const eosCount  = eosRes.data?.length ?? 0
      const patchRate = total > 0
        ? Math.round(((total - patchCount) / total) * 1000) / 10
        : 0

      setKpis([
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
          accent: "destructive",
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
          accent: "success",
          delay: 340,
          spark: [patchRate - 5, patchRate - 4, patchRate - 3, patchRate - 2, patchRate - 1, patchRate, patchRate],
        },
        {
          label: "EOS 만료 자산",
          value: eosCount,
          icon: CalendarX,
          trend: eosCount > 0 ? 12 : 0,
          trendLabel: "EOS 일자 경과",
          accent: "warning",
          delay: 460,
          spark: [eosCount - 2, eosCount - 2, eosCount - 1, eosCount - 1, eosCount, eosCount, eosCount],
        },
      ])
    })
  }, [])

  if (kpis.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border border-border/60 bg-card" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}
