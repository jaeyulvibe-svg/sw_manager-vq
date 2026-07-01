"use client"

import { useMemo, useState } from "react"
import {
  ClipboardCheck,
  Clock3,
  CircleCheck,
  CircleX,
  Check,
  X,
  Eye,
  Building2,
  User,
  Server,
  Link2,
} from "lucide-react"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  type Accent,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { cn } from "@/lib/utils"

type Approval = "승인대기" | "승인완료" | "반려"

type Req = {
  no: string
  name: string
  vendor: string
  category: string
  version: string
  server: string
  dept: string
  requester: string
  date: string
  mode: string
  sourceUrl: string
  reason: string
  approval: Approval
}

const initialRequests: Req[] = [
  {
    no: "REQ-2026-004",
    name: "Redis",
    vendor: "Redis Ltd.",
    category: "Middleware",
    version: "7.4",
    server: "CACHE-PRD-02",
    dept: "플랫폼개발팀",
    requester: "박민수",
    date: "오늘 09:14",
    mode: "AUTO",
    sourceUrl: "https://redis.io/docs/latest/",
    reason: "세션 캐시 및 실시간 랭킹 처리를 위한 신규 도입",
    approval: "승인대기",
  },
  {
    no: "REQ-2026-005",
    name: "Kubernetes",
    vendor: "CNCF",
    category: "Middleware",
    version: "1.30",
    server: "K8S-PRD-CLUSTER",
    dept: "인프라운영팀",
    requester: "정수빈",
    date: "오늘 08:40",
    mode: "SEMI_AUTO",
    sourceUrl: "https://kubernetes.io/docs/",
    reason: "컨테이너 오케스트레이션 표준화 및 배포 자동화",
    approval: "승인대기",
  },
  {
    no: "REQ-2026-006",
    name: "HAProxy",
    vendor: "HAProxy Technologies",
    category: "Security",
    version: "3.0",
    server: "LB-PRD-01",
    dept: "네트워크팀",
    requester: "김도현",
    date: "어제 17:22",
    mode: "AUTO",
    sourceUrl: "https://www.haproxy.org/",
    reason: "L7 로드밸런싱 및 TLS 종단 처리",
    approval: "승인대기",
  },
  {
    no: "REQ-2026-001",
    name: "Apache Tomcat",
    vendor: "Apache",
    category: "WAS",
    version: "10.1.24",
    server: "WAS-PRD-03",
    dept: "WAS운영팀",
    requester: "홍길동",
    date: "어제 11:05",
    mode: "AUTO",
    sourceUrl: "https://tomcat.apache.org/security.html",
    reason: "레거시 WAS 교체용 최신 버전 도입",
    approval: "승인완료",
  },
  {
    no: "REQ-2026-003",
    name: "Nginx",
    vendor: "F5",
    category: "WEB",
    version: "1.27",
    server: "WEB-PRD-02",
    dept: "웹서비스팀",
    requester: "이영희",
    date: "2일 전",
    mode: "AUTO",
    sourceUrl: "",
    reason: "정적 콘텐츠 서빙 및 리버스 프록시",
    approval: "반려",
  },
]

const approvalAccent: Record<Approval, Accent> = {
  승인대기: "warning",
  승인완료: "success",
  반려: "destructive",
}

const FILTERS = ["전체", "승인대기", "승인완료", "반려"] as const

export function ApprovalView() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<Req[]>(initialRequests)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("승인대기")
  const [selected, setSelected] = useState<Req | null>(
    initialRequests.find((r) => r.approval === "승인대기") ?? null,
  )

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.approval === "승인대기").length,
      approved: requests.filter((r) => r.approval === "승인완료").length,
      rejected: requests.filter((r) => r.approval === "반려").length,
    }),
    [requests],
  )

  const filtered = useMemo(
    () =>
      filter === "전체"
        ? requests
        : requests.filter((r) => r.approval === filter),
    [requests, filter],
  )

  function decide(req: Req, decision: Approval) {
    setRequests((prev) =>
      prev.map((r) => (r.no === req.no ? { ...r, approval: decision } : r)),
    )
    setSelected((prev) =>
      prev && prev.no === req.no ? { ...prev, approval: decision } : prev,
    )
    if (decision === "승인완료") {
      toast({
        tone: "success",
        title: "신규 자산 요청 승인 완료",
        description: `${req.name} (${req.no}) 요청을 승인하고 관리 대상으로 등록했습니다.`,
      })
    } else {
      toast({
        tone: "error",
        title: "신규 자산 요청 반려",
        description: `${req.name} (${req.no}) 요청을 반려했습니다. 요청자에게 사유가 통보됩니다.`,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardCheck}
        title="신규 자산 요청 승인"
        description="사용자가 요청한 신규 SW 자산을 관리자가 검토하고 승인 또는 반려합니다. 승인 시 공식 관리 대상으로 등록됩니다."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="승인 대기" value={counts.pending} icon={Clock3} accent="warning" delay={80} />
        <StatCard label="승인 완료" value={counts.approved} icon={CircleCheck} accent="success" delay={180} />
        <StatCard label="반려" value={counts.rejected} icon={CircleX} accent="destructive" delay={280} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Request list */}
        <div className="lg:col-span-3">
          <SectionCard
            title="요청 목록"
            subtitle="신규 자산 등록 요청 검토"
            icon={ClipboardCheck}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                    filter === f
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <TableShell>
              <thead>
                <tr>
                  <Th>요청번호</Th>
                  <Th>제품명</Th>
                  <Th>요청자</Th>
                  <Th>요청일</Th>
                  <Th>상태</Th>
                  <Th>조치</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.no}
                    onClick={() => setSelected(r)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-accent/40",
                      selected?.no === r.no ? "bg-primary/10" : "",
                    )}
                  >
                    <Td className="font-mono text-xs text-muted-foreground">{r.no}</Td>
                    <Td className="font-semibold">{r.name}</Td>
                    <Td>{r.requester}</Td>
                    <Td className="text-xs text-muted-foreground">{r.date}</Td>
                    <Td>
                      <StatusBadge accent={approvalAccent[r.approval]}>{r.approval}</StatusBadge>
                    </Td>
                    <Td>
                      {r.approval === "승인대기" ? (
                        <div className="flex items-center gap-1.5">
                          <MiniButton
                            accent="success"
                            onClick={(e) => {
                              e.stopPropagation()
                              decide(r, "승인완료")
                            }}
                          >
                            <Check className="h-3 w-3" />승인
                          </MiniButton>
                          <MiniButton
                            accent="destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              decide(r, "반려")
                            }}
                          >
                            <X className="h-3 w-3" />반려
                          </MiniButton>
                        </div>
                      ) : (
                        <MiniButton
                          accent="primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(r)
                          }}
                        >
                          <Eye className="h-3 w-3" />상세
                        </MiniButton>
                      )}
                    </Td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="border-b border-border/40 px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      해당 상태의 요청이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </TableShell>
          </SectionCard>
        </div>

        {/* Detail / decision panel */}
        <div className="lg:col-span-2">
          <SectionCard
            title="요청 상세"
            subtitle={selected ? selected.no : "요청을 선택하세요"}
            icon={Eye}
          >
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-foreground">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.vendor} · {selected.category} · v{selected.version}
                    </p>
                  </div>
                  <StatusBadge accent={approvalAccent[selected.approval]}>
                    {selected.approval}
                  </StatusBadge>
                </div>

                <dl className="grid grid-cols-1 gap-2.5">
                  <DetailRow icon={User} label="요청자" value={`${selected.requester} · ${selected.dept}`} />
                  <DetailRow icon={Server} label="설치 서버" value={selected.server} />
                  <DetailRow icon={Building2} label="수집 모드" value={selected.mode} />
                  <DetailRow
                    icon={Link2}
                    label="Source URL"
                    value={selected.sourceUrl || "미등록 (확인 필요)"}
                    warn={!selected.sourceUrl}
                  />
                </dl>

                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">요청 사유</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{selected.reason}</p>
                </div>

                {selected.approval === "승인대기" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(selected, "승인완료")}
                      className="glow-card inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/15 px-4 py-2.5 text-sm font-semibold text-success transition-transform hover:-translate-y-0.5"
                    >
                      <Check className="h-4 w-4" />
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(selected, "반려")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-2.5 text-sm font-semibold text-destructive transition-transform hover:-translate-y-0.5"
                    >
                      <X className="h-4 w-4" />
                      반려
                    </button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
                      selected.approval === "승인완료"
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-destructive/30 bg-destructive/10 text-destructive",
                    )}
                  >
                    {selected.approval === "승인완료" ? (
                      <CircleCheck className="h-4 w-4" />
                    ) : (
                      <CircleX className="h-4 w-4" />
                    )}
                    {selected.approval === "승인완료"
                      ? "승인 완료 · 관리 대상으로 등록됨"
                      : "반려됨 · 요청자에게 사유 통보"}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                왼쪽 목록에서 요청을 선택하면 상세 정보가 표시됩니다.
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof User
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium",
          warn ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}
