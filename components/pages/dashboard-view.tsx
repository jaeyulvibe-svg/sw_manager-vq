"use client"

import { History, ShieldAlert, PackageCheck, CalendarX, FilePlus2 } from "lucide-react"
import { ScanHero } from "@/components/dashboard/scan-hero"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { CriticalAlerts } from "@/components/dashboard/critical-alerts"
import {
  VulnerabilityTrend,
  SeverityDonut,
  PatchByOs,
} from "@/components/dashboard/charts"
import { SectionCard } from "@/components/portal/ui"
import { cn } from "@/lib/utils"

type Activity = {
  time: string
  text: string
  detail: string
  accent: "primary" | "destructive" | "warning" | "success" | "eos"
  icon: typeof History
}

const activities: Activity[] = [
  {
    time: "방금 전",
    text: "OpenSSL 3.0.x Critical 취약점 공지 수집",
    detail: "CVE-2026-0001 · 영향 자산 4대 · 승인대기",
    accent: "destructive",
    icon: ShieldAlert,
  },
  {
    time: "12분 전",
    text: "WebtoB 5.0 패치 승인 완료",
    detail: "WEB-PRD-01 · 담당자 이영희",
    accent: "success",
    icon: PackageCheck,
  },
  {
    time: "38분 전",
    text: "JEUS 7 EOS 임박 알림 발송",
    detail: "2026-12-31 단종 · 183일 남음",
    accent: "eos",
    icon: CalendarX,
  },
  {
    time: "1시간 전",
    text: "신규 자산 요청 등록 (PostgreSQL)",
    detail: "REQ-2026-002 · 요청자 김철수",
    accent: "primary",
    icon: FilePlus2,
  },
  {
    time: "2시간 전",
    text: "Apache Tomcat 9.0.x High 공지 매핑",
    detail: "CVE-2026-0002 · 영향 자산 8대",
    accent: "warning",
    icon: ShieldAlert,
  },
]

const dot: Record<Activity["accent"], string> = {
  primary: "bg-primary text-primary",
  destructive: "bg-destructive text-destructive",
  warning: "bg-warning text-warning",
  success: "bg-success text-success",
  eos: "bg-eos text-eos",
}

function RecentUpdates() {
  return (
    <SectionCard
      title="최근 업데이트 내역"
      subtitle="자산·취약점·패치 실시간 활동 로그"
      icon={History}
    >
      <ul className="flex flex-col">
        {activities.map((a, i) => (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i !== activities.length - 1 ? (
              <span className="absolute left-[15px] top-8 h-full w-px bg-border/60" />
            ) : null}
            <span
              className={cn(
                "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background",
              )}
            >
              <a.icon className={cn("h-4 w-4", dot[a.accent].split(" ")[1])} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {a.text}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {a.time}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {a.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function DashboardView() {
  return (
    <div className="flex flex-col gap-6">
      <ScanHero />
      <KpiCards />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <VulnerabilityTrend />
        <SeverityDonut />
        <PatchByOs />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CriticalAlerts />
        <RecentUpdates />
      </div>
    </div>
  )
}
