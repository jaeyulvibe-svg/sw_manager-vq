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
import { LineChart as LineChartIcon, PieChart as PieIcon, BarChart3 } from "lucide-react"

const trendData = [
  { month: "1월", detected: 620, patched: 410 },
  { month: "2월", detected: 700, patched: 520 },
  { month: "3월", detected: 540, patched: 500 },
  { month: "4월", detected: 810, patched: 690 },
  { month: "5월", detected: 640, patched: 610 },
  { month: "6월", detected: 480, patched: 470 },
  { month: "7월", detected: 342, patched: 338 },
]

const severityData = [
  { name: "긴급", value: 50, color: "var(--destructive)" },
  { name: "높음", value: 92, color: "var(--warning)" },
  { name: "보통", value: 130, color: "var(--primary)" },
  { name: "낮음", value: 70, color: "var(--success)" },
]

const osData = [
  { os: "Windows", value: 94 },
  { os: "Linux", value: 88 },
  { os: "macOS", value: 96 },
  { os: "Network", value: 79 },
  { os: "Cloud", value: 91 },
]

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className = "",
}: {
  title: string
  subtitle: string
  icon: typeof LineChartIcon
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

export function VulnerabilityTrend() {
  return (
    <ChartCard
      title="취약점 탐지 · 조치 추이"
      subtitle="AI 자동 패치 파이프라인 성과"
      icon={LineChartIcon}
      className="lg:col-span-2"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="detectedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="patchedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
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
            />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3 }} />
            <Area
              type="monotone"
              dataKey="detected"
              name="탐지"
              stroke="var(--destructive)"
              strokeWidth={2.5}
              fill="url(#detectedGrad)"
              animationDuration={1600}
            />
            <Area
              type="monotone"
              dataKey="patched"
              name="조치"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#patchedGrad)"
              animationDuration={1600}
              animationBegin={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> 탐지
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> 조치 완료
        </span>
      </div>
    </ChartCard>
  )
}

export function SeverityDonut() {
  const total = severityData.reduce((a, b) => a + b.value, 0)
  return (
    <ChartCard
      title="위험도별 분포"
      subtitle="미조치 취약점 342건"
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
          <span className="text-xs text-muted-foreground">총 취약점</span>
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

export function PatchByOs() {
  return (
    <ChartCard
      title="플랫폼별 패치 적용률"
      subtitle="AI 우선순위 기반 조치 현황"
      icon={BarChart3}
      className="lg:col-span-3"
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={osData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
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
