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
  Building2,
  Activity,
  CalendarClock,
  Layers,
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
      className={`glow-card animate-rise flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card p-5 ${className}`}
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
  const KNOWN_CATS = ["OS", "WEB", "WAS", "DB"]
  const known = KNOWN_CATS.map((cat) => ({
    name: cat,
    value: assets.filter((a) => a.category === cat).length,
    color: "var(--primary)",
  }))
  const otherCount = assets.filter((a) => !KNOWN_CATS.includes(a.category)).length
  const data = [...known, { name: "기타", value: otherCount, color: "var(--muted-foreground)" }].filter(
    (d) => d.value > 0,
  )

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ChartCard
      title="카테고리별 자산 구성"
      subtitle={`전체 ${total}개 자산 구성 · OS/WEB/WAS/DB/기타`}
      icon={BarChart3}
      className="h-full"
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
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            {d.name}
            <span className="ml-1 font-mono font-semibold text-foreground">
              {d.value}
              <span className="ml-0.5 text-muted-foreground">
                ({total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0}%)
              </span>
            </span>
          </span>
        ))}
      </div>
    </ChartCard>
  )
}

/* ---------------- EOS 도래 현황 ---------------- */

const EOS_BUCKETS = ["만료됨", "90일 이내", "91~180일", "181일~1년", "1년 초과", "정보 없음"] as const

const eosBucketColor: Record<string, string> = {
  만료됨: "var(--risk-5)",
  "90일 이내": "var(--risk-4)",
  "91~180일": "var(--risk-3)",
  "181일~1년": "var(--risk-2)",
  "1년 초과": "var(--risk-1)",
  "정보 없음": "var(--muted-foreground)",
}

function eosBucketOf(eos: string | null): (typeof EOS_BUCKETS)[number] {
  if (!eos) return "정보 없음"
  const t = new Date(eos).getTime()
  if (Number.isNaN(t)) return "정보 없음"
  const days = Math.floor((t - NOW) / 86400000)
  if (days < 0) return "만료됨"
  if (days <= 90) return "90일 이내"
  if (days <= 180) return "91~180일"
  if (days <= 365) return "181일~1년"
  return "1년 초과"
}

export function EosTimeline({ assets }: { assets: Asset[] }) {
  const data = EOS_BUCKETS.map((name) => ({
    name,
    value: assets.filter((a) => eosBucketOf(a.eos) === name).length,
    color: eosBucketColor[name],
  })).filter((d) => d.value > 0)

  const within180 = assets.filter((a) => {
    const b = eosBucketOf(a.eos)
    return b === "만료됨" || b === "90일 이내" || b === "91~180일"
  }).length

  return (
    <ChartCard title="EOS 도래 현황" subtitle={`180일 이내 도래 ${within180}건`} icon={CalendarClock} className="h-full">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar dataKey="value" name="자산 수" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500}>
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

/* ---------------- 제품·버전별 자산 구성 ---------------- */

export function ProductVersionBreakdown({ assets }: { assets: Asset[] }) {
  const productCounts = new Map<string, number>()
  for (const a of assets) {
    const key = `${a.name}__${a.vendor}`
    productCounts.set(key, (productCounts.get(key) ?? 0) + 1)
  }
  const topProducts = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key)

  type Row = { product: string; version: string; count: number; ratio: number }
  const rows: Row[] = []
  for (const key of topProducts) {
    const [name] = key.split("__")
    const productAssets = assets.filter((a) => `${a.name}__${a.vendor}` === key)
    const versionCounts = new Map<string, number>()
    for (const a of productAssets) {
      versionCounts.set(a.version, (versionCounts.get(a.version) ?? 0) + 1)
    }
    for (const [version, count] of [...versionCounts.entries()].sort((a, b) => b[1] - a[1])) {
      rows.push({
        product: name,
        version,
        count,
        ratio: Math.round((count / productAssets.length) * 1000) / 10,
      })
    }
  }

  const otherCount = assets.length - topProducts.reduce((s, key) => s + (productCounts.get(key) ?? 0), 0)

  return (
    <ChartCard
      title="제품·버전별 자산 구성"
      subtitle="자산 수 상위 제품의 버전 분포"
      icon={Layers}
      className="lg:col-span-2"
    >
      <div className="max-h-72 overflow-y-auto overflow-x-hidden">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="w-2/5 pb-2 font-medium">제품</th>
              <th className="w-1/5 pb-2 font-medium">버전</th>
              <th className="w-1/5 pb-2 text-right font-medium">자산 수</th>
              <th className="w-1/5 pb-2 text-right font-medium">비율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.product}-${r.version}-${i}`} className="border-t border-border/50">
                <td className="max-w-0 truncate py-2 pr-2 font-medium text-foreground" title={r.product}>
                  {r.product}
                </td>
                <td className="max-w-0 truncate py-2 pr-2 text-muted-foreground" title={r.version}>
                  {r.version}
                </td>
                <td className="py-2 text-right font-mono text-foreground">{r.count}</td>
                <td className="py-2 text-right font-mono text-muted-foreground">{r.ratio}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {otherCount > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">그 외 제품 {otherCount}건은 기타로 묶임 (자산 목록에서 상세 확인)</p>
      ) : null}
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
    { name: "정상",      value: normal,  color: "var(--risk-1)" },
    { name: "확인 필요", value: check,   color: "var(--risk-3)" },
    { name: "조치 필요", value: action,  color: "var(--risk-4)" },
    { name: "EOS 만료",  value: expired, color: "var(--risk-5)" },
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
