"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ShieldAlert, PieChart as PieIcon, BarChart3 } from "lucide-react"
import type { Tables } from "@/lib/supabase/types"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">

const CATEGORIES = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
}: {
  title: string
  subtitle: string
  icon: typeof PieIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`glow-card animate-rise flex flex-col rounded-2xl border border-border/60 bg-card p-5 ${className}`}
    >
      <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-foreground">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-primary/30 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      {label ? (
        <p className="mb-1 font-semibold text-foreground">{label}</p>
      ) : null}
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color || p.payload?.color }}
          />
          {p.name}:{" "}
          <span className="font-mono font-semibold text-foreground">
            {p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

/* ---------------- 1. 취약점 공지 처리 현황 (실데이터) ---------------- */

const APPROVAL_ORDER = ["승인대기", "검토중", "승인완료", "반려"] as const

const approvalColor: Record<string, string> = {
  승인대기: "var(--warning)",
  검토중: "var(--primary)",
  승인완료: "var(--success)",
  반려: "var(--destructive)",
}

export function VulnerabilityApprovalStatus({ vulns }: { vulns: Vulnerability[] }) {
  const data = APPROVAL_ORDER.map((status) => ({
    name: status,
    value: vulns.filter((v) => v.approval === status).length,
    color: approvalColor[status],
  })).filter((d) => d.value > 0)

  const criticalCount = vulns.filter((v) => v.severity === "Critical").length

  return (
    <ChartCard
      title="취약점 공지 처리 현황"
      subtitle={`수집된 공지 ${vulns.length}건 · Critical ${criticalCount}건`}
      icon={ShieldAlert}
      className="lg:col-span-2"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar dataKey="value" name="건수" radius={[6, 6, 0, 0]} maxBarSize={64} animationDuration={1500}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            {d.name}
            <span className="ml-1 font-mono font-semibold text-foreground">{d.value}</span>
          </span>
        ))}
      </div>
    </ChartCard>
  )
}

/* ---------------- 2. 위험도별 분포 (실데이터) ---------------- */

const SEVERITY_META = [
  { key: "Critical", name: "긴급", color: "var(--destructive)" },
  { key: "High", name: "높음", color: "var(--warning)" },
  { key: "Medium", name: "보통", color: "var(--primary)" },
  { key: "Low", name: "낮음", color: "var(--success)" },
] as const

export function SeverityDonut({ assets }: { assets: Asset[] }) {
  const severityData = SEVERITY_META.map((s) => ({
    name: s.name,
    value: assets.filter((a) => a.vuln === s.key).length,
    color: s.color,
  })).filter((d) => d.value > 0)

  const total = severityData.reduce((a, b) => a + b.value, 0)
  const unresolved = assets.filter((a) => a.vuln !== "Low").length

  return (
    <ChartCard
      title="위험도별 분포"
      subtitle={`미조치 취약점 ${unresolved}건`}
      icon={PieIcon}
    >
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<TooltipBox />} />
            <Pie
              data={severityData}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={3}
              animationDuration={1400}
            >
              {severityData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-foreground">
            {total}
          </span>
          <span className="text-xs text-muted-foreground">총 자산</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {severityData.map((s) => (
          <span
            key={s.name}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: s.color }}
            />
            {s.name}
            <span className="ml-auto font-mono font-semibold text-foreground">
              {s.value}
            </span>
          </span>
        ))}
      </div>
    </ChartCard>
  )
}

/* ---------------- 3. 카테고리별 패치 적용률 (실데이터) ---------------- */

export function PatchByCategory({ assets }: { assets: Asset[] }) {
  const data = CATEGORIES.map((cat) => {
    const items = assets.filter((a) => a.category === cat)
    if (items.length === 0) return null
    const upToDate = items.filter((a) => a.patch === "Up to Date").length
    return { os: cat, value: Math.round((upToDate / items.length) * 100) }
  }).filter((d): d is { os: string; value: number } => d !== null)

  return (
    <ChartCard
      title="카테고리별 패치 적용률"
      subtitle="분류별 최신 패치 반영 비율"
      icon={BarChart3}
      className="lg:col-span-3"
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="os"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              unit="%"
            />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar
              dataKey="value"
              name="패치율"
              fill="url(#barGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={56}
              animationDuration={1500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
