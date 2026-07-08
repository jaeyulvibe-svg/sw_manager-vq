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
import {
  PieChart as PieIcon,
  BarChart3,
  Grid3x3,
  Building2,
  Activity,
} from "lucide-react"
import type { Tables } from "@/lib/supabase/types"

type Asset = Tables<"assets">

// Computed once at module load (not during render) so it stays a pure value for react-hooks/purity.
const NOW = Date.now()

/* ---------------- shared card + tooltip ---------------- */

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
        <p
          key={p.name}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color || p.fill || p.payload?.color }}
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

/* ---------------- 1. 카테고리별 SW 자산 분포 ---------------- */

export function CategoryDistribution({ assets }: { assets: Asset[] }) {
  const CATS = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]
  const data = CATS.map((cat) => ({
    name: cat,
    value: assets.filter((a) => a.category === cat).length,
    color: "var(--primary)",
  })).filter((d) => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title="카테고리별 SW 자산 분포"
      subtitle={`전체 ${total}개 자산 구성`}
      icon={BarChart3}
      className="lg:col-span-2"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar dataKey="value" name="자산 수" radius={[6, 6, 0, 0]} maxBarSize={54} animationDuration={1500}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

/* ---------------- 2. 자산 건전성 현황 (donut) ---------------- */

export function AssetHealth({ assets }: { assets: Asset[] }) {
  const normal  = assets.filter((a) => a.vuln === "Low" && a.patch === "Up to Date" && !(a.eos && new Date(a.eos).getTime() < NOW)).length
  const check   = assets.filter((a) => a.vuln === "Medium" || a.patch === "Patch Available").length
  const action  = assets.filter((a) => a.patch === "Patch Required" || a.vuln === "High").length
  const expired = assets.filter((a) => a.eos && new Date(a.eos).getTime() < NOW).length

  const healthData = [
    { name: "정상",      value: normal,  color: "var(--success)" },
    { name: "확인 필요", value: check,   color: "var(--warning)" },
    { name: "조치 필요", value: action,  color: "var(--destructive)" },
    { name: "EOS 만료",  value: expired, color: "var(--eos)" },
  ].filter((d) => d.value > 0)

  const total = healthData.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard title="자산 건전성 현황" subtitle="관리 상태 기반 분류" icon={Activity}>
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<TooltipBox />} />
            <Pie
              data={healthData}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={3}
              animationDuration={1400}
            >
              {healthData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">전체 자산</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {healthData.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
            <span className="ml-auto font-mono font-semibold text-foreground">{s.value}</span>
          </span>
        ))}
      </div>
    </ChartCard>
  )
}

/* ---------------- 3. 카테고리별 관리 필요 현황 (히트맵 매트릭스) ----------- */

const RISK_CATEGORIES = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]

const RISK_METRICS = [
  { key: "eos", name: "EOS 만료", color: "var(--eos)" },
  { key: "patch", name: "패치 필요", color: "var(--warning)" },
  { key: "vuln", name: "취약점", color: "var(--destructive)" },
  { key: "approval", name: "승인 대기", color: "var(--primary)" },
] as const

export function ManageNeed({ assets }: { assets: Asset[] }) {
  const rows = RISK_CATEGORIES.map((cat) => {
    const items = assets.filter((a) => a.category === cat)
    return {
      category: cat,
      eos: items.filter((a) => a.eos && new Date(a.eos).getTime() < NOW).length,
      patch: items.filter((a) => a.patch === "Patch Required").length,
      vuln: items.filter((a) => a.vuln === "Critical" || a.vuln === "High").length,
      approval: items.filter((a) => a.approval === "승인대기" || a.approval === "긴급").length,
    }
  }).filter((r) => r.eos + r.patch + r.vuln + r.approval > 0)

  const max = Math.max(1, ...rows.flatMap((r) => RISK_METRICS.map((m) => r[m.key])))

  return (
    <ChartCard title="카테고리별 관리 필요 현황" subtitle="항목별 위험도 매트릭스" icon={Grid3x3}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-left font-semibold text-muted-foreground">분류</th>
              {RISK_METRICS.map((m) => (
                <th key={m.key} className="p-1.5 text-center font-semibold text-muted-foreground">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <td className="whitespace-nowrap p-1.5 font-semibold text-foreground">{r.category}</td>
                {RISK_METRICS.map((m) => {
                  const value = r[m.key]
                  const pct = value === 0 ? 0 : Math.round(20 + 65 * (value / max))
                  return (
                    <td key={m.key} className="p-1">
                      <div
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg font-mono text-sm font-bold text-foreground"
                        style={{
                          background:
                            value === 0
                              ? "var(--muted)"
                              : `color-mix(in oklch, ${m.color} ${pct}%, var(--card))`,
                          opacity: value === 0 ? 0.5 : 1,
                        }}
                      >
                        {value}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}

/* ---------------- 4. 벤더별 자산 현황 (실데이터 기반 가로 막대) ---------------- */

export function VendorDistribution({ assets }: { assets: Asset[] }) {
  const counts = new Map<string, number>()
  for (const a of assets) {
    if (!a.vendor) continue
    counts.set(a.vendor, (counts.get(a.vendor) ?? 0) + 1)
  }
  const data = [...counts.entries()]
    .map(([vendor, value]) => ({ vendor, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <ChartCard title="벤더별 자산 현황" subtitle="공급사별 보유 자산 수" icon={Building2}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="vendor" width={110} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar dataKey="value" name="자산 수" fill="var(--primary)" radius={[0, 6, 6, 0]} maxBarSize={22} animationDuration={1400} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
