"use client"

import { useEffect, useState } from "react"
import {
  Megaphone,
  FileEdit,
  Rss,
  CalendarX,
  Package,
  ShieldAlert,
  ClipboardCheck,
} from "lucide-react"
import { SectionCard, StatusBadge, type Accent, type RiskLevel } from "@/components/portal/ui"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

/* ---------------- 공지사항 ---------------- */

type Notice = Tables<"notices">

const noticeCategoryAccent: Record<string, Accent> = {
  시스템: "primary",
  운영: "success",
  승인: "eos",
  보고서: "muted",
}

function NoticePanel() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setNotices(data)
        setLoading(false)
      })
  }, [])

  return (
    <SectionCard title="공지사항" subtitle="포털 운영 공지" icon={Megaphone}>
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          등록된 공지사항이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {notices.map((n) => (
            <li
              key={n.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <StatusBadge accent={noticeCategoryAccent[n.category] ?? "muted"}>
                {n.category}
              </StatusBadge>
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                {n.title}
              </p>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString("ko-KR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/* ---------------- SW 자산 변경 요청 ---------------- */

type ChangeReq = {
  title: string
  requester: string
  status: "승인대기" | "검토중" | "승인완료"
  icon: typeof Package
}

const changeReqRisk: Record<ChangeReq["status"], RiskLevel> = {
  승인대기: 3,
  검토중: 2,
  승인완료: 1,
}

const changeReqs: ChangeReq[] = [
  {
    title: "신규 자산 등록 요청",
    requester: "김철수 · 미들웨어팀",
    status: "승인대기",
    icon: Package,
  },
  {
    title: "자산 정보 변경 요청",
    requester: "이영희 · 인프라팀",
    status: "검토중",
    icon: FileEdit,
  },
  {
    title: "담당자 변경 요청",
    requester: "박민수 · 운영팀",
    status: "승인완료",
    icon: ClipboardCheck,
  },
  {
    title: "폐기 예정 자산 요청",
    requester: "정지훈 · DBA팀",
    status: "승인대기",
    icon: CalendarX,
  },
]

function ChangeRequestPanel() {
  return (
    <SectionCard
      title="SW 자산 변경 요청"
      subtitle="등록·변경·폐기 요청 현황"
      icon={FileEdit}
    >
      <ul className="flex flex-col divide-y divide-border/50">
        {changeReqs.map((r, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                changeReqRisk[r.status] === 3 && "border-risk-3/40 bg-risk-3/15 text-risk-3",
                changeReqRisk[r.status] === 2 && "border-risk-2/40 bg-risk-2/12 text-risk-2",
                changeReqRisk[r.status] === 1 && "border-risk-1/40 bg-risk-1/12 text-risk-1",
              )}
            >
              <r.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {r.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.requester}
              </p>
            </div>
            <StatusBadge risk={changeReqRisk[r.status]}>{r.status}</StatusBadge>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/* ---------------- EOS/패치/보안공지 피드 ---------------- */

type Feed = {
  text: string
  meta: string
  accent: Accent
  icon: typeof CalendarX
}

const feeds: Feed[] = [
  {
    text: "JEUS 7 EOS 일정 확인 필요",
    meta: "2027-06-30 단종 예정",
    accent: "eos",
    icon: CalendarX,
  },
  {
    text: "Apache Tomcat 패치 공지 수집",
    meta: "9.0.89 → 9.0.90 권장",
    accent: "warning",
    icon: Package,
  },
  {
    text: "OpenSSL 보안공지 수집",
    meta: "CVE-2026-0001 · Critical",
    accent: "destructive",
    icon: ShieldAlert,
  },
  {
    text: "Oracle DB 패치 승인 대기",
    meta: "19c CPU 2026-04 · 승인대기",
    accent: "primary",
    icon: ClipboardCheck,
  },
]

function FeedPanel() {
  return (
    <SectionCard
      title="EOS·패치·보안공지 피드"
      subtitle="자산 연계 실시간 수집 이벤트"
      icon={Rss}
    >
      <ul className="flex flex-col">
        {feeds.map((f, i) => (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i !== feeds.length - 1 ? (
              <span className="absolute left-[15px] top-8 h-full w-px bg-border/60" />
            ) : null}
            <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
              <f.icon
                className={cn(
                  "h-4 w-4",
                  f.accent === "eos" && "text-eos",
                  f.accent === "warning" && "text-warning",
                  f.accent === "destructive" && "text-destructive",
                  f.accent === "primary" && "text-primary",
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {f.text}
              </p>
              <p className="truncate text-xs text-muted-foreground">{f.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function AssetBoards() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <NoticePanel />
      <ChangeRequestPanel />
      <FeedPanel />
    </div>
  )
}
