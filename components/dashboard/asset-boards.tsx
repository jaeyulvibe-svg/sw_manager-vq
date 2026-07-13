"use client"

import { useEffect, useState } from "react"
import {
  Megaphone,
  FileEdit,
  Rss,
  CalendarX,
  Package,
  ShieldAlert,
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

type AssetRequest = Tables<"asset_requests">

const requestApprovalRisk: Record<AssetRequest["approval"], RiskLevel> = {
  반려: 5,
  승인대기: 3,
  검토중: 2,
  승인완료: 1,
}

function ChangeRequestPanel() {
  const [requests, setRequests] = useState<AssetRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("asset_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setRequests(data)
        setLoading(false)
      })
  }, [])

  return (
    <SectionCard
      title="SW 자산 변경 요청"
      subtitle="등록·변경·폐기 요청 현황"
      icon={FileEdit}
    >
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          등록된 자산 변경 요청이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {requests.map((r) => {
            const risk = requestApprovalRisk[r.approval]
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    risk === 5 && "border-risk-5/40 bg-risk-5/15 text-risk-5",
                    risk === 3 && "border-risk-3/40 bg-risk-3/15 text-risk-3",
                    risk === 2 && "border-risk-2/40 bg-risk-2/12 text-risk-2",
                    risk === 1 && "border-risk-1/40 bg-risk-1/12 text-risk-1",
                  )}
                >
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.requester} · {r.requester_dept}
                  </p>
                </div>
                <StatusBadge risk={risk}>{r.approval}</StatusBadge>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

/* ---------------- EOS/패치/보안공지 피드 ---------------- */

type Vulnerability = Tables<"vulnerabilities">
type NoticeType = Vulnerability["notice_type"]

const feedNoticeTypeAccent: Record<NoticeType, Accent> = {
  CVE: "destructive",
  Patch: "warning",
  EOS: "eos",
}

const feedNoticeTypeIcon: Record<NoticeType, typeof CalendarX> = {
  CVE: ShieldAlert,
  Patch: Package,
  EOS: CalendarX,
}

function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

function FeedPanel() {
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("vulnerabilities")
      .select("*")
      .order("collected_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setVulns(data)
        setLoading(false)
      })
  }, [])

  return (
    <SectionCard
      title="EOS·패치·보안공지 피드"
      subtitle="자산 연계 실시간 수집 이벤트"
      icon={Rss}
    >
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : vulns.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          수집된 공지가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col">
          {vulns.map((v, i) => {
            const accent = feedNoticeTypeAccent[v.notice_type]
            const Icon = feedNoticeTypeIcon[v.notice_type]
            return (
              <li key={v.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i !== vulns.length - 1 ? (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-border/60" />
                ) : null}
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      accent === "eos" && "text-eos",
                      accent === "warning" && "text-warning",
                      accent === "destructive" && "text-destructive",
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {v.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.product} · {formatCollected(v.collected_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
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
