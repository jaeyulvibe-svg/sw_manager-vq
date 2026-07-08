"use client"

import {
  Area,
  AreaChart,
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
  LineChart as LineChartIcon,
  Activity,
} from "lucide-react"
import type { Tables } from "@/lib/supabase/types"

type Asset = Tables<"assets">

// Computed once at module load (not during render) so it stays a pure value for react-hooks/purity.
const NOW = Date.now()

/* ---------------- 고정 데이터 (월별 등록 추이는 DB 미지원으로 유지) ---- */

const monthlyReg = [
  { month: "1월", 신규: 2, 변경: 1, 폐기: 0 },
  { month: "2월", 신규: 3, 변경: 1, 폐기: 0 },
  { month: "3월", 신규: 4, 변경: 2, 폐기: 1 },
  { month: "4월", 신규: 3, 변경: 2, 폐기: 0 },
  { month: "5월", 신규: 5, 변경: 1, 폐기: 1 },
  { month: "6월", 신규: 4, 변경: 3, 폐기: 1 },
]

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
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
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
  const CATS = ["OS", "WEB", "DB", "Middleware"]
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

/* ---------------- 3. 카테고리별 관리 필요 현황 (stacked bar) ----------- */

export function ManageNeed({ assets }: { assets: Asset[] }) {
  const CATS = ["OS", "WEB", "DB", "Middleware"]

  const data = CATS.map((cat) => {
    const items = assets.filter((a) => a.category === cat)
    return {
      category: cat,
      EOS만료:  items.filter((a) => a.eos && new Date(a.eos).getTime() < NOW).length,
      패치필요: items.filter((a) => a.patch === "Patch Required").length,
      취약점:   items.filter((a) => a.vuln === "Critical" || a.vuln === "High").length,
      승인대기: items.filter((a) => a.approval === "승인대기" || a.approval === "긴급").length,
    }
  }).filter((d) => d.EOS만료 + d.패치필요 + d.취약점 + d.승인대기 > 0)

  const series = [
    { key: "EOS만료",  name: "EOS 만료",  color: "var(--eos)" },
    { key: "패치필요", name: "패치 필요", color: "var(--warning)" },
    { key: "취약점",   name: "취약점",    color: "var(--destructive)" },
    { key: "승인대기", name: "승인 대기", color: "var(--primary)" },
  ]

  return (
    <ChartCard
      title="카테고리별 관리 필요 현황"
      subtitle="조치가 필요한 자산 집계"
      icon={BarChart3}
      className="lg:col-span-3"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="need"
                fill={s.color}
                radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={64}
                animationDuration={1400}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </ChartCard>
  )
}

/* ---------------- 4. 월별 SW 자산 등록 추이 (고정) ---------------- */

export function MonthlyRegistration() {
  return (
    <ChartCard
      title="월별 SW 자산 등록 추이"
      subtitle="신규·변경·폐기 등록 현황"
      icon={LineChartIcon}
      className="lg:col-span-3"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyReg} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="regNew" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="regChange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="regRetire" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--eos)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--eos)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3 }} />
            <Area type="monotone" dataKey="신규" name="신규 등록" stroke="var(--primary)" strokeWidth={2.5} fill="url(#regNew)" animationDuration={1500} />
            <Area type="monotone" dataKey="변경" name="변경 등록" stroke="var(--success)" strokeWidth={2.5} fill="url(#regChange)" animationDuration={1500} animationBegin={200} />
            <Area type="monotone" dataKey="폐기" name="폐기 예정" stroke="var(--eos)" strokeWidth={2.5} fill="url(#regRetire)" animationDuration={1500} animationBegin={400} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> 신규 등록
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> 변경 등록
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-eos" /> 폐기 예정
        </span>
      </div>
    </ChartCard>
  )
}
