"use client"

import {
  CalendarClock,
  CalendarX,
  CalendarDays,
  CalendarCheck,
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
  type Accent,
} from "@/components/portal/ui"
import { cn } from "@/lib/utils"

const timeline = [
  { month: "2026-08", count: 1 },
  { month: "2026-09", count: 2 },
  { month: "2026-10", count: 3 },
  { month: "2026-11", count: 1 },
  { month: "2026-12", count: 4 },
  { month: "2027-01", count: 2 },
  { month: "2027-02", count: 1 },
  { month: "2027-03", count: 3 },
]

type Risk = "Critical" | "High" | "Medium" | "Low"

type EosItem = {
  name: string
  vendor: string
  version: string
  owner: string
  eos: string
  remain: string
  remainPct: number
  risk: Risk
  action: string
}

const items: EosItem[] = [
  { name: "OpenSSL 3.0.x", vendor: "OpenSSL Project", version: "3.0.x", owner: "정재율", eos: "2026-10-31", remain: "122일", remainPct: 18, risk: "Critical", action: "긴급 검토" },
  { name: "JEUS 7", vendor: "TmaxSoft", version: "7.0", owner: "김철수", eos: "2026-12-31", remain: "183일", remainPct: 30, risk: "High", action: "업그레이드 검토" },
  { name: "Apache Tomcat 9.0.x", vendor: "Apache", version: "9.0.89", owner: "홍길동", eos: "2027-03-31", remain: "273일", remainPct: 48, risk: "Medium", action: "패치 계획" },
  { name: "Red Hat Enterprise Linux", vendor: "Red Hat", version: "8.x", owner: "인프라팀", eos: "2029-05-31", remain: "장기", remainPct: 92, risk: "Low", action: "정상" },
]

const riskAccent: Record<Risk, Accent> = {
  Critical: "destructive", High: "warning", Medium: "primary", Low: "success",
}
const riskLabel: Record<Risk, string> = {
  Critical: "긴급", High: "높음", Medium: "보통", Low: "낮음",
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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarClock}
        title="EOS 로드맵"
        description="SW 자산별 EOS/EOL 일정을 월별로 추적하고 지원 종료 위험을 사전에 관리합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="30일 이내 EOS" value={3} icon={CalendarX} accent="destructive" delay={80} />
        <StatCard label="90일 이내 EOS" value={7} icon={CalendarClock} accent="warning" delay={180} />
        <StatCard label="6개월 이내 EOS" value={12} icon={CalendarDays} accent="eos" delay={280} />
        <StatCard label="EOS 완료 자산" value={5} icon={CalendarCheck} accent="success" delay={380} />
      </div>

      <SectionCard
        title="월별 EOS 일정"
        subtitle="지원 종료 예정 자산 분포"
        icon={CalendarClock}
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
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
      >
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
            {items.map((it) => {
              const soon = it.remainPct <= 35
              return (
                <tr key={it.name} className="transition-colors hover:bg-accent/40">
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
                        accent={it.remainPct <= 20 ? "destructive" : it.remainPct <= 35 ? "warning" : it.remainPct <= 60 ? "primary" : "success"}
                        className="w-24"
                      />
                      <span className="font-mono text-xs text-muted-foreground">{it.remainPct}%</span>
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge accent={riskAccent[it.risk]} pulse={it.risk === "Critical"}>
                      {riskLabel[it.risk]}
                    </StatusBadge>
                  </Td>
                  <Td className="text-sm">{it.action}</Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      </SectionCard>
    </div>
  )
}
