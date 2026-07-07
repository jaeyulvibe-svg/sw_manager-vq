"use client"

import { useState } from "react"
import {
  ShieldAlert,
  ExternalLink,
  Link2,
  Check,
  X,
  BellRing,
  BellDot,
  Server,
  ArrowRight,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  MiniButton,
  type Accent,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import type { ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"

type Severity = "Critical" | "High" | "Medium" | "Low"
type Status = "승인대기" | "검토중" | "승인완료"

type Notice = {
  id: string
  title: string
  source: string
  cve: string
  severity: Severity
  affected: string
  collected: string
  assets: number
  status: Status
  mapped: boolean
}

const notices: Notice[] = [
  {
    id: "N1",
    title: "OpenSSL Critical Vulnerability Security Advisory",
    source: "Vendor Security Advisory",
    cve: "CVE-2026-0001",
    severity: "Critical",
    affected: "OpenSSL 3.0.x",
    collected: "오늘 09:30",
    assets: 4,
    status: "승인대기",
    mapped: true,
  },
  {
    id: "N2",
    title: "Apache Tomcat High Vulnerability Notice",
    source: "KISA",
    cve: "CVE-2026-0002",
    severity: "High",
    affected: "Apache Tomcat 9.0.x",
    collected: "오늘 10:15",
    assets: 8,
    status: "검토중",
    mapped: true,
  },
  {
    id: "N3",
    title: "Oracle Critical Patch Update",
    source: "Oracle Security Advisory",
    cve: "Multiple CVEs",
    severity: "Critical",
    affected: "Oracle Database 19c",
    collected: "어제 17:40",
    assets: 2,
    status: "승인완료",
    mapped: true,
  },
  {
    id: "N4",
    title: "Nginx Medium Severity Advisory",
    source: "Release Notes",
    cve: "CVE-2026-0044",
    severity: "Medium",
    affected: "Nginx 1.24",
    collected: "어제 14:05",
    assets: 0,
    status: "검토중",
    mapped: false,
  },
]

const FILTERS = ["전체", "Critical", "High", "Medium", "Low", "미매핑", "승인대기"] as const

const sevAccent: Record<Severity, Accent> = {
  Critical: "destructive", High: "warning", Medium: "primary", Low: "success",
}
const statusAccent: Record<Status, Accent> = {
  승인대기: "warning", 검토중: "primary", 승인완료: "success",
}

export function KisaView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const { isAdmin } = useRole()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체")
  const [selectedId, setSelectedId] = useState<string>("N1")

  const filtered = notices.filter((n) => {
    if (filter === "전체") return true
    if (filter === "미매핑") return !n.mapped
    if (filter === "승인대기") return n.status === "승인대기"
    return n.severity === filter
  })

  const selected = notices.find((n) => n.id === selectedId) ?? notices[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldAlert}
        title="KISA 취약점 공지"
        description="KISA 및 제조사 공식 보안공지 Source에서 수집한 신규 취약점 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. 승인된 공지는 '패치&취약점 모니터링'에서 전사 현황으로 확인할 수 있습니다."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Feed */}
        <div className="flex flex-col gap-3 lg:col-span-3">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              className={cn(
                "group animate-rise rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5",
                n.severity === "Critical" && n.status === "승인대기"
                  ? "border-destructive/40 animate-soft-pulse"
                  : "border-border/60 glow-card",
                selectedId === n.id && "ring-2 ring-primary/50",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge accent={sevAccent[n.severity]} pulse={n.severity === "Critical"}>
                  {n.severity}
                </StatusBadge>
                <span className="font-mono text-xs text-muted-foreground">{n.cve}</span>
                {!n.mapped ? (
                  <StatusBadge accent="muted">미매핑</StatusBadge>
                ) : null}
                <StatusBadge accent={statusAccent[n.status]} className="ml-auto">
                  {n.status}
                </StatusBadge>
              </div>
              <p className="text-sm font-semibold text-foreground">{n.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{n.source}</span>
                <span className="flex items-center gap-1"><Server className="h-3 w-3" />영향 {n.affected}</span>
                <span>{n.status === "승인완료" ? `매핑 확정 ${n.assets}대` : `매칭 후보 ${n.assets}대`}</span>
                <span className="ml-auto">{n.collected}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          <SectionCard title="공지 상세" subtitle={selected.cve} icon={ShieldAlert}>
            <div className="flex flex-col gap-4">
              <div>
                <StatusBadge accent={sevAccent[selected.severity]} pulse={selected.severity === "Critical"}>
                  {selected.severity}
                </StatusBadge>
                <h4 className="mt-2 text-sm font-bold text-foreground">{selected.title}</h4>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["수집 Source", selected.source],
                  ["CVE ID", selected.cve],
                  ["영향 제품", selected.affected],
                  ["수집 일시", selected.collected],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Affected assets matching */}
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Server className="h-3.5 w-3.5 text-primary" />
                  {selected.status === "승인완료"
                    ? `매핑 확정 자산 ${selected.assets}대`
                    : `자동 매칭 후보 ${selected.assets}대 (승인 전)`}
                </p>
                {selected.assets > 0 ? (
                  <>
                    <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center justify-between rounded-md bg-card px-2 py-1.5">
                        <span className="font-mono">SEC-PRD-01</span>
                        <span>정재율</span>
                      </li>
                      <li className="flex items-center justify-between rounded-md bg-card px-2 py-1.5">
                        <span className="font-mono">WAS-PRD-01</span>
                        <span>홍길동</span>
                      </li>
                    </ul>
                    {selected.status !== "승인완료" ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        시스템이 제품명 기준으로 자동 매칭한 후보 목록입니다. 관리자가 승인해야 확정되며, 승인 전까지는 담당자에게 전파되지 않습니다.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    매칭된 자산이 없습니다. 자산 매핑을 실행하세요.
                  </p>
                )}
              </div>

              {/* Actions — 관리자는 분석 결과 승인·전파, 담당자는 알림 수신 확인 */}
              <div className="flex flex-wrap gap-2">
                <MiniButton accent="primary"><ExternalLink className="h-3 w-3" />상세보기</MiniButton>
                {isAdmin ? (
                  <>
                    <MiniButton accent="eos"><Link2 className="h-3 w-3" />자산 매핑</MiniButton>
                    <MiniButton accent="success"><Check className="h-3 w-3" />승인</MiniButton>
                    <MiniButton accent="destructive"><X className="h-3 w-3" />반려</MiniButton>
                    <MiniButton accent="warning"><BellRing className="h-3 w-3" />사용자 알림 전파</MiniButton>
                  </>
                ) : (
                  <MiniButton accent="warning"><BellDot className="h-3 w-3" />알림 수신 확인</MiniButton>
                )}
                {selected.status === "승인완료" && onNavigate ? (
                  <MiniButton accent="success" onClick={() => onNavigate("patch")}>
                    <ArrowRight className="h-3 w-3" />패치&취약점 모니터링에서 보기
                  </MiniButton>
                ) : null}
              </div>
              {!isAdmin ? (
                <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  사용자는 관리자의 승인·전파 후 배정된 자산에 대한 알림을 확인합니다.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
