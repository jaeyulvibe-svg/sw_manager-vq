"use client"

import { useMemo, useState } from "react"
import {
  Megaphone,
  ShieldAlert,
  Eye,
  Link2,
  Check,
  X,
  BellRing,
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
  type Accent,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { useRole } from "@/components/portal/role-context"
import { cn } from "@/lib/utils"

/* ==================== Board 1: 공지사항 ==================== */

type NoticeStatus = "일반" | "중요" | "긴급"

type Notice = {
  id: string
  category: string
  title: string
  author: string
  date: string
  views: number
  status: NoticeStatus
}

const notices: Notice[] = [
  {
    id: "NT-04",
    category: "시스템",
    title: "AI SW Asset Master 정기 점검 안내",
    author: "관리자",
    date: "2026-07-01",
    views: 128,
    status: "중요",
  },
  {
    id: "NT-03",
    category: "운영",
    title: "신규 SW 자산 등록 기준 안내",
    author: "관리자",
    date: "2026-06-28",
    views: 94,
    status: "일반",
  },
  {
    id: "NT-02",
    category: "승인",
    title: "패치 승인 프로세스 변경 안내",
    author: "승인관리자",
    date: "2026-06-25",
    views: 76,
    status: "중요",
  },
  {
    id: "NT-01",
    category: "보고서",
    title: "6월 SW 자산·보안 월간 보고서 생성 안내",
    author: "관리자",
    date: "2026-06-24",
    views: 63,
    status: "일반",
  },
]

const noticeStatusAccent: Record<NoticeStatus, Accent> = {
  일반: "muted",
  중요: "warning",
  긴급: "destructive",
}

const categoryAccent: Record<string, Accent> = {
  시스템: "primary",
  운영: "success",
  승인: "eos",
  보고서: "muted",
}

export function NoticeBoard() {
  const { toast } = useToast()

  // 최신 공지 우선 정렬
  const sorted = useMemo(
    () =>
      [...notices].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [],
  )

  return (
    <SectionCard
      title="공지사항"
      subtitle="시스템 운영·점검·자산 등록 기준·패치 승인 절차 안내"
      icon={Megaphone}
      action={
        <MiniButton accent="primary">
          <ExternalLink className="h-3 w-3" />
          전체보기
        </MiniButton>
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
          {sorted.map((n) => (
            <tr
              key={n.id}
              className="transition-colors hover:bg-accent/40"
            >
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
                          ? "bg-destructive animate-blink"
                          : "bg-warning",
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
                {n.date}
              </Td>
              <Td className="text-right font-mono tabular-nums text-muted-foreground">
                {n.views.toLocaleString()}
              </Td>
              <Td>
                <StatusBadge
                  accent={noticeStatusAccent[n.status]}
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
                      description: `${n.title} (${n.author} · ${n.date})`,
                    })
                  }
                >
                  <Eye className="h-3 w-3" />
                  상세
                </MiniButton>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </SectionCard>
  )
}

/* ============ Board 2: 긴급 보안공지 / 취약점 ============ */

type Severity = "Critical" | "High" | "Medium" | "Low"
type ApprovalStatus = "승인대기" | "검토중" | "승인완료" | "반려"

type SecurityNotice = {
  id: string
  severity: Severity
  title: string
  cve: string
  product: string
  mapped: number
  source: string
  sourceUrl: string
  collectedAt: string
  approval: ApprovalStatus
}

const securityNotices: SecurityNotice[] = [
  {
    id: "SN-01",
    severity: "Critical",
    title: "OpenSSL 원격 코드 실행 취약점 보안공지",
    cve: "CVE-2026-0001",
    product: "OpenSSL 3.0.x",
    mapped: 4,
    source: "KNVD",
    sourceUrl: "knvd.krcert.or.kr",
    collectedAt: "오늘 09:30",
    approval: "승인대기",
  },
  {
    id: "SN-02",
    severity: "High",
    title: "Apache Tomcat 취약점 보안 업데이트 권고",
    cve: "CVE-2026-0002",
    product: "Apache Tomcat 9.0.x",
    mapped: 8,
    source: "KrCERT",
    sourceUrl: "krcert.or.kr",
    collectedAt: "오늘 10:15",
    approval: "검토중",
  },
  {
    id: "SN-03",
    severity: "Critical",
    title: "Oracle Database Critical Patch Update",
    cve: "Multiple CVEs",
    product: "Oracle Database 19c",
    mapped: 2,
    source: "Vendor Advisory",
    sourceUrl: "제조사 Security Advisory",
    collectedAt: "어제 17:40",
    approval: "승인완료",
  },
  {
    id: "SN-04",
    severity: "High",
    title: "Nginx 보안 패치 권고",
    cve: "CVE-2026-0003",
    product: "Nginx 1.x",
    mapped: 5,
    source: "KNVD",
    sourceUrl: "knvd.krcert.or.kr",
    collectedAt: "어제 15:20",
    approval: "승인대기",
  },
]

const severityAccent: Record<Severity, Accent> = {
  Critical: "destructive",
  High: "warning",
  Medium: "primary",
  Low: "muted",
}

const approvalAccent: Record<ApprovalStatus, Accent> = {
  승인대기: "warning",
  검토중: "primary",
  승인완료: "success",
  반려: "destructive",
}

const SEVERITY_FILTERS: (Severity | "전체")[] = [
  "전체",
  "Critical",
  "High",
  "Medium",
  "Low",
]
const APPROVAL_FILTERS: (ApprovalStatus | "전체")[] = [
  "전체",
  "승인대기",
  "검토중",
  "승인완료",
  "반려",
]

export function SecurityNoticeBoard() {
  const { toast } = useToast()
  const { isAdmin } = useRole()
  const [query, setQuery] = useState("")
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]>(
    "전체",
  )
  const [approval, setApproval] = useState<(typeof APPROVAL_FILTERS)[number]>(
    "전체",
  )

  const filtered = useMemo(() => {
    return securityNotices.filter((s) => {
      const q = query.trim().toLowerCase()
      const matchesQuery =
        q === "" ||
        s.cve.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.product.toLowerCase().includes(q)
      const matchesSeverity = severity === "전체" || s.severity === severity
      const matchesApproval = approval === "전체" || s.approval === approval
      return matchesQuery && matchesSeverity && matchesApproval
    })
  }, [query, severity, approval])

  return (
    <SectionCard
      title="긴급 보안공지 / 취약점"
      subtitle="KNVD·KrCERT·제조사 Advisory 수집 · 자산 매핑 및 조치 관리"
      icon={ShieldAlert}
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
                      : accentPill[severityAccent[f as Severity]]
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* 승인 상태 필터 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              승인
            </span>
            {APPROVAL_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setApproval(f)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  approval === f
                    ? "border-primary/50 bg-primary/15 text-primary"
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
            <Th>승인 상태</Th>
            <Th className="text-right">조치</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-accent/40">
              <Td>
                <StatusBadge
                  accent={severityAccent[s.severity]}
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
                      description: `${s.source} · ${s.sourceUrl}`,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  <Link2 className="h-3 w-3" />
                  {s.source}
                </button>
              </Td>
              <Td className="font-mono text-xs text-muted-foreground">
                {s.collectedAt}
              </Td>
              <Td>
                <StatusBadge accent={approvalAccent[s.approval]}>
                  {s.approval}
                </StatusBadge>
              </Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <MiniButton
                    accent="primary"
                    onClick={() =>
                      toast({
                        tone: "info",
                        title: "취약점 상세보기",
                        description: `${s.cve} · ${s.product} · 매핑 자산 ${s.mapped}개`,
                      })
                    }
                  >
                    <Eye className="h-3 w-3" />
                    상세
                  </MiniButton>
                  {isAdmin ? (
                    <>
                      <MiniButton
                        accent="eos"
                        onClick={() =>
                          toast({
                            tone: "info",
                            title: "자산 매핑",
                            description: `${s.product} 관련 자산 ${s.mapped}개를 매핑합니다.`,
                          })
                        }
                      >
                        <Link2 className="h-3 w-3" />
                        매핑
                      </MiniButton>
                      <MiniButton
                        accent="success"
                        onClick={() =>
                          toast({
                            tone: "success",
                            title: "승인 요청 처리",
                            description: `${s.cve} 조치 승인이 요청되었습니다.`,
                          })
                        }
                      >
                        <Check className="h-3 w-3" />
                        승인
                      </MiniButton>
                      <MiniButton
                        accent="destructive"
                        onClick={() =>
                          toast({
                            tone: "danger",
                            title: "반려 처리",
                            description: `${s.cve} 공지가 반려되었습니다.`,
                          })
                        }
                      >
                        <X className="h-3 w-3" />
                        반려
                      </MiniButton>
                      <MiniButton
                        accent="warning"
                        onClick={() =>
                          toast({
                            tone: "info",
                            title: "담당자 알림 전파",
                            description: `${s.product} 담당자에게 조치 알림을 발송했습니다.`,
                          })
                        }
                      >
                        <BellRing className="h-3 w-3" />
                        알림
                      </MiniButton>
                    </>
                  ) : (
                    <MiniButton
                      accent="warning"
                      onClick={() =>
                        toast({
                          tone: "info",
                          title: "알림 수신 확인",
                          description: `${s.cve} 조치 알림을 확인했습니다.`,
                        })
                      }
                    >
                      <BellRing className="h-3 w-3" />
                      알림 확인
                    </MiniButton>
                  )}
                </div>
              </Td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="border-b border-border/40 px-3 py-8 text-center text-sm text-muted-foreground"
              >
                검색 조건에 맞는 보안공지가 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </TableShell>
    </SectionCard>
  )
}

const accentPill: Record<Accent, string> = {
  primary: "border-primary/50 bg-primary/15 text-primary",
  success: "border-success/50 bg-success/15 text-success",
  warning: "border-warning/50 bg-warning/15 text-warning",
  destructive: "border-destructive/50 bg-destructive/15 text-destructive",
  eos: "border-eos/50 bg-eos/15 text-eos",
  muted: "border-border/60 bg-muted/60 text-muted-foreground",
}
