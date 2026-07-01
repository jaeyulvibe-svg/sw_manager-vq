"use client"

import {
  Users,
  UserCog,
  ShieldAlert,
  Percent,
  BellRing,
  Wrench,
  Trophy,
} from "lucide-react"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  ProgressBar,
  TableShell,
  Th,
  Td,
  MiniButton,
  type Accent,
} from "@/components/portal/ui"
import { cn } from "@/lib/utils"

type Owner = {
  name: string
  dept: string
  assets: number
  critical: number
  high: number
  patch: number
  eos: number
  rate: number
  lastNotified: string
}

const owners: Owner[] = [
  { name: "정재율", dept: "인프라팀", assets: 24, critical: 2, high: 5, patch: 7, eos: 1, rate: 72, lastNotified: "오늘 10:30" },
  { name: "홍길동", dept: "WAS운영팀", assets: 18, critical: 1, high: 4, patch: 5, eos: 2, rate: 68, lastNotified: "오늘 09:50" },
  { name: "김철수", dept: "미들웨어팀", assets: 15, critical: 0, high: 3, patch: 2, eos: 1, rate: 81, lastNotified: "어제" },
  { name: "이영희", dept: "WEB운영팀", assets: 12, critical: 0, high: 1, patch: 2, eos: 0, rate: 92, lastNotified: "어제" },
]

function rateAccent(rate: number): Accent {
  if (rate >= 90) return "success"
  if (rate >= 80) return "primary"
  if (rate >= 70) return "warning"
  return "destructive"
}

const rankStyle = ["text-warning", "text-muted-foreground", "text-eos", "text-muted-foreground"]

export function OwnerView() {
  // ranking by risk: critical*3 + high
  const ranked = [...owners].sort(
    (a, b) => b.critical * 3 + b.high - (a.critical * 3 + a.high),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="소유자별 취약점 패치"
        description="담당자별로 보유 중인 SW 자산의 취약점, 패치 필요 여부, EOS 위험을 통합 확인합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="담당자 수" value={18} icon={Users} accent="primary" delay={80} />
        <StatCard label="조치 필요 담당자" value={6} icon={UserCog} accent="warning" delay={180} />
        <StatCard label="미처리 취약점" value={37} icon={ShieldAlert} accent="destructive" delay={280} />
        <StatCard label="패치 완료율" value={78} suffix="%" icon={Percent} accent="success" delay={380} />
      </div>

      {/* Risk ranking */}
      <SectionCard title="담당자 위험도 랭킹" subtitle="Critical·High 취약점 기준 상위 담당자" icon={Trophy}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ranked.map((o, i) => (
            <div
              key={o.name}
              className="animate-rise rounded-xl border border-border/60 bg-background/40 p-4 transition-transform hover:-translate-y-1"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Trophy className={cn("h-4 w-4", rankStyle[i] ?? "text-muted-foreground")} />
                  {i + 1}위
                </span>
                <StatusBadge accent={rateAccent(o.rate)}>{o.rate}%</StatusBadge>
              </div>
              <p className="text-sm font-semibold text-foreground">{o.name}</p>
              <p className="text-xs text-muted-foreground">{o.dept}</p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <StatusBadge accent="destructive" pulse={o.critical > 0}>C {o.critical}</StatusBadge>
                <StatusBadge accent="warning">H {o.high}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Patch action table */}
      <SectionCard title="담당자별 조치 현황" subtitle="보유 자산 및 조치율" icon={Wrench}>
        <TableShell>
          <thead>
            <tr>
              <Th>담당자</Th>
              <Th>부서</Th>
              <Th>보유 자산</Th>
              <Th>Critical</Th>
              <Th>High</Th>
              <Th>패치 필요</Th>
              <Th>EOS 임박</Th>
              <Th className="min-w-40">조치율</Th>
              <Th>최근 알림</Th>
              <Th>작업</Th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.name} className="transition-colors hover:bg-accent/40">
                <Td className="font-semibold">{o.name}</Td>
                <Td className="text-muted-foreground">{o.dept}</Td>
                <Td className="font-mono">{o.assets}</Td>
                <Td>
                  {o.critical > 0 ? (
                    <StatusBadge accent="destructive" pulse>{o.critical}</StatusBadge>
                  ) : (
                    <span className="font-mono text-muted-foreground">0</span>
                  )}
                </Td>
                <Td>
                  {o.high > 0 ? (
                    <StatusBadge accent="warning">{o.high}</StatusBadge>
                  ) : (
                    <span className="font-mono text-muted-foreground">0</span>
                  )}
                </Td>
                <Td className="font-mono">{o.patch}</Td>
                <Td className="font-mono">
                  {o.eos > 0 ? <span className="text-eos">{o.eos}</span> : "0"}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={o.rate} accent={rateAccent(o.rate)} className="w-24" />
                    <span className="font-mono text-xs text-muted-foreground">{o.rate}%</span>
                  </div>
                </Td>
                <Td className="text-xs text-muted-foreground">{o.lastNotified}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <MiniButton accent="warning"><BellRing className="h-3 w-3" />알림 발송</MiniButton>
                    <MiniButton accent="primary"><Wrench className="h-3 w-3" />패치 요청</MiniButton>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>
    </div>
  )
}
