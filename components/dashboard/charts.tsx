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
import { ShieldAlert, PieChart as PieIcon, Wrench, ClipboardList } from "lucide-react"
import type { Tables } from "@/lib/supabase/types"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">
type PatchTask = Tables<"patch_tasks">

// Computed once at module load (not during render) so it stays a pure value for react-hooks/purity.
const NOW = Date.now()

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
  반려: "var(--risk-5)",
  승인대기: "var(--risk-3)",
  검토중: "var(--risk-2)",
  승인완료: "var(--risk-1)",
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
  { key: "Critical", name: "긴급", color: "var(--risk-5)" },
  { key: "High", name: "높음", color: "var(--risk-4)" },
  { key: "Medium", name: "보통", color: "var(--risk-3)" },
  { key: "Low", name: "낮음", color: "var(--risk-2)" },
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

/* ---------------- 3. 패치 적용 현황 (실데이터) ---------------- */

const PATCH_META = [
  { key: "Up to Date", name: "최신 적용", color: "var(--risk-1)" },
  { key: "Patch Available", name: "패치 가능", color: "var(--risk-3)" },
  { key: "Patch Required", name: "패치 필요", color: "var(--risk-5)" },
] as const

export function PatchApplicationStatus({ assets }: { assets: Asset[] }) {
  const data = PATCH_META.map((p) => ({
    name: p.name,
    value: assets.filter((a) => a.patch === p.key).length,
    color: p.color,
  })).filter((d) => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  const requiredCount = assets.filter((a) => a.patch === "Patch Required").length
  const rate = total > 0 ? Math.round(((total - requiredCount) / total) * 1000) / 10 : 0

  return (
    <ChartCard title="패치 적용 현황" subtitle={`패치 적용률 ${rate}%`} icon={Wrench}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar dataKey="value" name="자산 수" radius={[6, 6, 0, 0]} maxBarSize={64} animationDuration={1500}>
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

/* ---------------- 4. 보안 조치 업무 현황 (실데이터) ---------------- */

const TASK_STATUS_META = [
  { key: "배정됨", color: "var(--risk-3)" },
  { key: "조치예정", color: "var(--risk-2)" },
  { key: "조치지연", color: "var(--risk-5)" },
  { key: "조치완료", color: "var(--risk-1)" },
  { key: "예외요청", color: "var(--risk-4)" },
  { key: "예외승인", color: "var(--muted-foreground)" },
] as const

export function PatchTaskStatus({ patchTasks }: { patchTasks: PatchTask[] }) {
  const data = TASK_STATUS_META.map((s) => ({
    name: s.key,
    value: patchTasks.filter((t) => t.status === s.key).length,
    color: s.color,
  })).filter((d) => d.value > 0)

  const overdue = patchTasks.filter(
    (t) =>
      t.status !== "조치완료" &&
      t.status !== "예외승인" &&
      t.due_date &&
      new Date(t.due_date).getTime() < NOW,
  ).length

  return (
    <ChartCard title="보안 조치 업무 현황" subtitle={`기한 초과 ${overdue}건`} icon={ClipboardList}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--primary)", fillOpacity: 0.08 }} />
            <Bar dataKey="value" name="건수" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500}>
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

