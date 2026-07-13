"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Megaphone,
  ShieldAlert,
  Eye,
  Link2,
  Search,
  ExternalLink,
} from "lucide-react"
import {
  SectionCard,
  TableShell,
  Th,
  Td,
  StatusBadge,
  MiniButton,
  ExportExcelButton,
  usePagination,
  Pagination,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { matchAssets } from "@/lib/vuln-match"
import { cn } from "@/lib/utils"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">
type Notice = Tables<"notices">

/* ==================== Board 1: 공지사항 (실데이터) ==================== */

const noticeStatusRisk: Record<string, RiskLevel | undefined> = {
  일반: undefined,
  중요: 3,
  긴급: 5,
}

const categoryAccent: Record<string, Accent> = {
  시스템: "primary",
  운영: "success",
  승인: "eos",
  보고서: "muted",
}

export function NoticeBoard() {
  const { toast } = useToast()
  const [notices, setNotices] = useState<Notice[]>([])
  const pagination = usePagination(notices)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotices(data)
      })
  }, [])

  return (
    <SectionCard
      title="공지사항"
      subtitle="시스템 운영·점검·자산 등록 기준·패치 승인 절차 안내"
      icon={Megaphone}
      action={
        <div className="flex items-center gap-1.5">
          <ExportExcelButton
            rows={notices}
            filename="공지사항"
            columns={[
              { label: "구분", value: (n: Notice) => n.category },
              { label: "제목", value: (n: Notice) => n.title },
              { label: "작성자", value: (n: Notice) => n.author },
              { label: "등록일", value: (n: Notice) => new Date(n.created_at).toLocaleDateString("ko-KR") },
              { label: "조회수", value: (n: Notice) => n.views },
              { label: "상태", value: (n: Notice) => n.status },
            ]}
          />
          <MiniButton accent="primary">
            <ExternalLink className="h-3 w-3" />
            전체보기
          </MiniButton>
        </div>
      }
    >
      <TableShell>
        <thead>
          <tr>
            <Th>구분</Th>
            <Th>제목</Th>
            <Th>작성자</Th>
            <Th>등록일</Th>
            <Th className="text-right">조회수</Th>
            <Th>상태</Th>
            <Th className="text-right">관리</Th>
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((n) => (
            <tr key={n.id} className="transition-colors hover:bg-accent/40">
              <Td>
                <StatusBadge accent={categoryAccent[n.category] ?? "muted"}>
                  {n.category}
                </StatusBadge>
              </Td>
              <Td className="max-w-xs">
                <div className="flex items-center gap-2">
                  {n.status !== "일반" ? (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        n.status === "긴급"
                          ? "bg-risk-5 animate-blink"
                          : "bg-risk-3",
                      )}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "truncate",
                      n.status !== "일반"
                        ? "font-semibold text-foreground"
                        : "text-foreground/90",
                    )}
                  >
                    {n.title}
                  </span>
                </div>
              </Td>
              <Td className="text-muted-foreground">{n.author}</Td>
              <Td className="font-mono text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString("ko-KR")}
              </Td>
              <Td className="text-right font-mono tabular-nums text-muted-foreground">
                {n.views.toLocaleString()}
              </Td>
              <Td>
                <StatusBadge
                  accent="muted"
                  risk={noticeStatusRisk[n.status]}
                  pulse={n.status === "긴급"}
                >
                  {n.status}
                </StatusBadge>
              </Td>
              <Td className="text-right">
                <MiniButton
                  accent="primary"
                  onClick={() =>
                    toast({
                      tone: "info",
                      title: "공지 상세보기",
                      description: `${n.title} (${n.author})`,
                    })
                  }
                >
                  <Eye className="h-3 w-3" />
                  상세
                </MiniButton>
              </Td>
            </tr>
          ))}
          {notices.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="border-b border-border/40 px-3 py-8 text-center text-sm text-muted-foreground"
              >
                등록된 공지사항이 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </TableShell>

      {notices.length > 0 ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      ) : null}
    </SectionCard>
  )
}

/* ============ Board 2: 긴급 보안공지 / 취약점 (실데이터) ============ */

function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

type Severity = Vulnerability["severity"]

const severityRisk: Record<Severity, RiskLevel> = {
  Critical: 5,
  High: 4,
  Medium: 3,
  Low: 2,
}

const SEVERITY_FILTERS: (Severity | "전체")[] = [
  "전체",
  "Critical",
  "High",
  "Medium",
  "Low",
]

export function SecurityNoticeBoard({
  assets,
  vulns,
}: {
  assets: Asset[]
  vulns: Vulnerability[]
}) {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]>(
    "전체",
  )

  // 대시보드는 조회 전용 — 승인이 완료된 취약점만 노출한다
  const approved = useMemo(
    () => vulns.filter((v) => v.approval === "승인완료"),
    [vulns],
  )

  const rows = useMemo(
    () => approved.map((v) => ({ ...v, mapped: matchAssets(v, assets).length })),
    [approved, assets],
  )

  const filtered = useMemo(() => {
    return rows.filter((s) => {
      const q = query.trim().toLowerCase()
      const matchesQuery =
        q === "" ||
        s.cve.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.product.toLowerCase().includes(q)
      const matchesSeverity = severity === "전체" || s.severity === severity
      return matchesQuery && matchesSeverity
    })
  }, [rows, query, severity])

  const pagination = usePagination(filtered)

  useEffect(() => {
    pagination.setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, severity])

  return (
    <SectionCard
      title="긴급 보안공지 / 취약점"
      subtitle="KNVD·KrCERT·제조사 Advisory 수집 · 승인 완료된 취약점만 조회 전용으로 표시"
      icon={ShieldAlert}
      action={
        <ExportExcelButton
          rows={filtered}
          filename="긴급_보안공지_취약점"
          columns={[
            { label: "위험도", value: (s) => s.severity },
            { label: "공지 제목", value: (s) => s.title },
            { label: "CVE", value: (s) => s.cve },
            { label: "영향 제품", value: (s) => s.product },
            { label: "매핑 자산", value: (s) => s.mapped },
            { label: "수집 Source", value: (s) => s.source },
            { label: "수집일시", value: (s) => formatCollected(s.collected_at) },
          ]}
        />
      }
    >
      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3">
        {/* CVE 기준 검색 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="CVE·제목·제품 검색 (예: CVE-2026-0001)"
            className="w-full rounded-lg border border-border/60 bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* 위험도 필터 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              위험도
            </span>
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSeverity(f)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  severity === f
                    ? f === "전체"
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : riskPill[severityRisk[f as Severity]]
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TableShell>
        <thead>
          <tr>
            <Th>위험도</Th>
            <Th>공지 제목</Th>
            <Th>CVE</Th>
            <Th>영향 제품</Th>
            <Th className="text-right">매핑 자산</Th>
            <Th>수집 Source</Th>
            <Th>수집일시</Th>
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-accent/40">
              <Td>
                <StatusBadge
                  risk={severityRisk[s.severity]}
                  pulse={s.severity === "Critical"}
                >
                  {s.severity}
                </StatusBadge>
              </Td>
              <Td className="max-w-xs">
                <span className="block truncate font-medium text-foreground">
                  {s.title}
                </span>
              </Td>
              <Td className="font-mono text-xs text-primary">{s.cve}</Td>
              <Td className="text-muted-foreground">{s.product}</Td>
              <Td className="text-right font-mono tabular-nums text-foreground">
                {s.mapped}개
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() =>
                    toast({
                      tone: "info",
                      title: "수집 Source 확인",
                      description: `${s.source} · ${s.source_url ?? "공식 URL 미등록"}`,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  <Link2 className="h-3 w-3" />
                  {s.source}
                </button>
              </Td>
              <Td className="font-mono text-xs text-muted-foreground">
                {formatCollected(s.collected_at)}
              </Td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="border-b border-border/40 px-3 py-8 text-center text-sm text-muted-foreground"
              >
                검색 조건에 맞는 보안공지가 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </TableShell>

      {filtered.length > 0 ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      ) : null}
    </SectionCard>
  )
}

const riskPill: Record<RiskLevel, string> = {
  5: "border-risk-5/50 bg-risk-5/15 text-risk-5",
  4: "border-risk-4/50 bg-risk-4/15 text-risk-4",
  3: "border-risk-3/50 bg-risk-3/15 text-risk-3",
  2: "border-risk-2/50 bg-risk-2/15 text-risk-2",
  1: "border-risk-1/50 bg-risk-1/15 text-risk-1",
}
