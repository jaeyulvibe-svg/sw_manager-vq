"use client"

import {
  ShieldAlert,
  PackageCheck,
  CalendarX,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react"
import { useCountUp } from "@/hooks/use-count-up"
import { cn } from "@/lib/utils"

type Kpi = {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon: LucideIcon
  trend: number
  trendLabel: string
  accent: "primary" | "destructive" | "warning" | "success"
  delay: number
}

const kpis: Kpi[] = [
  {
    label: "관리 대상 자산",
    value: 14829,
    icon: PackageCheck,
    trend: 3.2,
    trendLabel: "전월 대비",
    accent: "primary",
    delay: 100,
  },
  {
    label: "미조치 취약점 (CVE)",
    value: 342,
    icon: ShieldAlert,
    trend: -18.5,
    trendLabel: "전주 대비 감소",
    accent: "destructive",
    delay: 220,
  },
  {
    label: "패치 적용률",
    value: 92.4,
    suffix: "%",
    decimals: 1,
    icon: TrendingUp,
    trend: 5.7,
    trendLabel: "이번 분기",
    accent: "success",
    delay: 340,
  },
  {
    label: "EOS 임박 자산",
    value: 87,
    icon: CalendarX,
    trend: 12.0,
    trendLabel: "90일 이내 단종",
    accent: "warning",
    delay: 460,
  },
]

const accentMap: Record<Kpi["accent"], string> = {
  primary: "text-primary",
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
}

const accentBg: Record<Kpi["accent"], string> = {
  primary: "bg-primary/12 text-primary",
  destructive: "bg-destructive/12 text-destructive",
  warning: "bg-warning/12 text-warning",
  success: "bg-success/12 text-success",
}

function KpiCard({ kpi }: { kpi: Kpi }) {
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
        <span className="text-sm font-medium text-muted-foreground">
          {kpi.label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            accentBg[kpi.accent],
          )}
        >
          <kpi.icon className="h-5 w-5" />
        </span>
      </div>

      <div
        className={cn(
          "font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl",
          accentMap[kpi.accent],
        )}
      >
        {animated.toLocaleString("en-US", {
          minimumFractionDigits: kpi.decimals ?? 0,
          maximumFractionDigits: kpi.decimals ?? 0,
        })}
        <span className="text-2xl sm:text-3xl">{kpi.suffix}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            "flex items-center gap-1 font-semibold",
            positive ? "text-success" : "text-destructive",
          )}
        >
          <TrendIcon className="h-3.5 w-3.5" />
          {Math.abs(kpi.trend)}%
        </span>
        <span className="text-muted-foreground">{kpi.trendLabel}</span>
      </div>
    </div>
  )
}

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  )
}
