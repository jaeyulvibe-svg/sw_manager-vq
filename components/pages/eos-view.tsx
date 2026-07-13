"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarClock,
  CalendarX,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  AlertTriangle,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  ProgressBar,
  TableShell,
  Th,
  Td,
  ExportExcelButton,
  type RiskLevel,
} from "@/components/portal/ui"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type Asset = Tables<"assets">
type Risk = "Critical" | "High" | "Medium" | "Low"
type EosRow = Asset & {
  eos: string
  days: number
  remain: string
  remainPct: number
  risk: Risk
  action: string
}

const riskLevelMap: Record<Risk, RiskLevel> = {
  Critical: 5, High: 4, Medium: 3, Low: 2,
}
const riskLabel: Record<Risk, string> = {
  Critical: "긴급", High: "높음", Medium: "보통", Low: "낮음",
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function riskFromDays(days: number): Risk {
  if (days <= 90) return "Critical"
  if (days <= 182) return "High"
  if (days <= 365) return "Medium"
  return "Low"
}

const actionLabel: Record<Risk, string> = {
  Critical: "긴급 검토", High: "업그레이드 검토", Medium: "패치 계획", Low: "정상",
}

function enrichAsset(a: Asset & { eos: string }): EosRow {
  const days = daysUntil(a.eos)
  return {
    ...a,
    days,
    remain: days < 0 ? "만료" : days <= 365 ? `${days}일` : "장기",
    remainPct: Math.max(0, Math.min(100, Math.round((days / (365 * 2)) * 100))),
    risk: riskFromDays(days),
    action: actionLabel[riskFromDays(days)],
  }
}

/** EOS 날짜 기준 상호 배타적 위험 구간별 자산 건수 */
function countByEosWindow(assets: Asset[]) {
  let expired = 0
  let within3m = 0
  let within6m = 0
  let within12m = 0
  for (const a of assets) {
    if (!a.eos) continue
    const days = daysUntil(a.eos)
    if (days < 0) expired++
    else if (days <= 90) within3m++
    else if (days <= 182) within6m++
    else if (days <= 365) within12m++
  }
  return { expired, within3m, within6m, within12m }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** 오늘이 속한 달부터 11개월 뒤까지, 12개월 롤링 윈도우로 월별 EOS 건수를 집계한다. */
function buildMonthlyBuckets(assets: Asset[]) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const buckets: { month: string; label: string; count: number }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    buckets.push({
      month: monthKey(d),
      label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
    })
  }
  const bucketByMonth = new Map(buckets.map((b) => [b.month, b]))
  for (const a of assets) {
    if (!a.eos) continue
    const eosDate = new Date(a.eos)
    if (isNaN(eosDate.getTime())) continue
    const bucket = bucketByMonth.get(monthKey(eosDate))
    if (bucket) bucket.count += 1
  }
  return buckets
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-eos/40 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">
        EOS 예정:{" "}
        <span className="font-mono font-semibold text-eos">{payload[0].value}건</span>
      </p>
    </div>
  )
}

export function EosView() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("assets")
      .select("*")
      .then(({ data }) => {
        if (data) setAssets(data)
        setLoading(false)
      })
  }, [])

  const { expired, within3m, within6m, within12m } = useMemo(() => countByEosWindow(assets), [assets])
  const timeline = useMemo(() => buildMonthlyBuckets(assets), [assets])
  const eosRows = useMemo(
    () =>
      assets
        .filter((a): a is Asset & { eos: string } => !!a.eos)
        .map(enrichAsset)
        .sort((a, b) => a.days - b.days),
    [assets],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarClock}
        title="EOS 로드맵"
        description="SW 자산별 EOS/EOL 일정을 월별로 추적하고 지원 종료 위험을 사전에 관리합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="만료자산" value={expired} icon={CalendarX} risk={5} delay={80} />
        <StatCard label="3개월 이내" value={within3m} icon={CalendarClock} risk={4} delay={180} />
        <StatCard label="6개월 이내" value={within6m} icon={CalendarDays} risk={3} delay={280} />
        <StatCard label="12개월 이내" value={within12m} icon={CalendarRange} risk={2} delay={380} />
      </div>

      <SectionCard
        title="월별 EOS 일정"
        subtitle="이번 달부터 12개월간 지원 종료 예정 자산 분포"
        icon={CalendarClock}
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--eos)", fillOpacity: 0.08 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={46} animationDuration={1400}>
                {timeline.map((t, i) => (
                  <Cell key={i} fill={t.count >= 3 ? "var(--eos)" : "var(--primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="EOS 위험 자산"
        subtitle="지원 종료 임박 자산 조치 현황"
        icon={AlertTriangle}
        action={
          <ExportExcelButton
            rows={eosRows}
            filename="EOS_위험_자산"
            columns={[
              { label: "제품명", value: (it: EosRow) => it.name },
              { label: "벤더", value: (it: EosRow) => it.vendor },
              { label: "현재 버전", value: (it: EosRow) => it.version },
              { label: "담당자", value: (it: EosRow) => it.owner },
              { label: "EOS 날짜", value: (it: EosRow) => it.eos },
              { label: "남은 기간", value: (it: EosRow) => it.remain },
              { label: "잔여 수명(%)", value: (it: EosRow) => it.remainPct },
              { label: "영향도", value: (it: EosRow) => riskLabel[it.risk] },
              { label: "조치 상태", value: (it: EosRow) => it.action },
            ]}
          />
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
        ) : eosRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">EOS 날짜가 등록된 자산이 없습니다.</p>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>제품명</Th>
                <Th>벤더</Th>
                <Th>현재 버전</Th>
                <Th>담당자</Th>
                <Th>EOS 날짜</Th>
                <Th>남은 기간</Th>
                <Th className="min-w-40">잔여 수명</Th>
                <Th>영향도</Th>
                <Th>조치 상태</Th>
              </tr>
            </thead>
            <tbody>
              {eosRows.map((it) => {
                const soon = it.remainPct <= 35
                return (
                  <tr key={it.id} className="transition-colors hover:bg-accent/40">
                    <Td className="font-semibold">
                      <span className="flex items-center gap-1.5">
                        {soon ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-eos" />
                        ) : (
                          <CircleCheck className="h-3.5 w-3.5 text-success" />
                        )}
                        {it.name}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{it.vendor}</Td>
                    <Td className="font-mono text-xs">{it.version}</Td>
                    <Td>{it.owner}</Td>
                    <Td>
                      <StatusBadge accent="eos">{it.eos}</StatusBadge>
                    </Td>
                    <Td className={cn("font-mono text-xs", soon && "font-bold text-eos")}>
                      {it.remain}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={it.remainPct}
                          risk={
                            it.remainPct <= 20
                              ? 5
                              : it.remainPct <= 35
                                ? 4
                                : it.remainPct <= 50
                                  ? 3
                                  : it.remainPct <= 70
                                    ? 2
                                    : 1
                          }
                          className="w-24"
                        />
                        <span className="font-mono text-xs text-muted-foreground">{it.remainPct}%</span>
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge risk={riskLevelMap[it.risk]} pulse={it.risk === "Critical"}>
                        {riskLabel[it.risk]}
                      </StatusBadge>
                    </Td>
                    <Td className="text-sm">{it.action}</Td>
                  </tr>
                )
              })}
            </tbody>
          </TableShell>
        )}
      </SectionCard>
    </div>
  )
}
