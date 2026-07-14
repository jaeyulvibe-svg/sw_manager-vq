"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ClipboardCheck,
  Clock3,
  CircleCheck,
  CircleX,
  Check,
  X,
  Eye,
  User,
  Server,
  CalendarClock,
  Flag,
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
  ExportExcelButton,
  usePagination,
  Pagination,
  type RiskLevel,
} from "@/components/portal/ui"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { useToast } from "@/components/portal/toast"
import { useNotifications } from "@/components/portal/notifications-context"
import { cn } from "@/lib/utils"

type AssetRequest = Tables<"asset_requests">
type Approval = AssetRequest["approval"]

const approvalRisk: Record<Approval, RiskLevel> = {
  반려: 5,
  승인대기: 3,
  검토중: 2,
  승인완료: 1,
}

const FILTERS = ["전체", "승인대기", "검토중", "승인완료", "반려"] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function ApprovalView() {
  const { toast } = useToast()
  const { refresh: refreshNotifications } = useNotifications()

  const [requests, setRequests] = useState<AssetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function loadRequests() {
    const supabase = createClient()
    supabase
      .from("asset_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setRequests(data)
          setSelectedId((cur) => cur ?? data.find((r) => r.approval === "승인대기")?.id ?? data[0]?.id ?? null)
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const selected = requests.find((r) => r.id === selectedId) ?? null

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.approval === "승인대기" || r.approval === "검토중").length,
      approved: requests.filter((r) => r.approval === "승인완료").length,
      rejected: requests.filter((r) => r.approval === "반려").length,
    }),
    [requests],
  )

  const filtered = useMemo(
    () => (filter === "전체" ? requests : requests.filter((r) => r.approval === filter)),
    [requests, filter],
  )
  const pagination = usePagination(filtered)

  async function decide(req: AssetRequest, decision: "승인완료" | "반려") {
    if (busyId) return
    setBusyId(req.id)
    const supabase = createClient()

    if (decision === "승인완료") {
      const { error: assetError } = await supabase.from("assets").insert({
        name: req.name,
        vendor: req.vendor,
        category: req.category as Tables<"assets">["category"],
        version: req.version,
        latest_version: req.version,
        server: req.server,
        owner: req.owner,
        vuln: "Low",
        patch: "Up to Date",
        approval: "확인필요",
      })
      if (assetError) {
        setBusyId(null)
        toast({
          tone: "danger",
          title: "자산 등록 실패",
          description: `${req.name} 자산을 자산 목록에 등록하지 못해 승인을 중단했습니다: ${assetError.message}`,
        })
        return
      }

      const { data: existingMaster } = await supabase
        .from("sw_masters")
        .select("id, std_version")
        .eq("name", req.name)
        .eq("vendor", req.vendor)
        .eq("active", true)
        .is("deleted_at", null)
        .maybeSingle()

      if (!existingMaster || existingMaster.std_version !== req.version) {
        const { error: masterError } = await supabase.from("sw_masters").insert({
          name: req.name,
          vendor: req.vendor,
          category: req.category as Tables<"sw_masters">["category"],
          std_version: req.version,
          active: true,
          updated_by: req.owner,
        })
        if (masterError) {
          toast({
            tone: "danger",
            title: "SW 마스터 반영 실패",
            description: `${req.name} ${req.version}을(를) SW 마스터에 추가하지 못했습니다: ${masterError.message}`,
          })
        } else {
          toast({
            tone: "success",
            title: "SW 마스터에 새 버전 등록됨",
            description: `${req.name} ${req.version}이(가) SW 마스터에 새 항목으로 추가되었습니다.`,
          })
        }
      }
    }

    await supabase.from("asset_requests").update({ approval: decision }).eq("id", req.id)

    await supabase.from("notifications").insert({
      category: "asset",
      title: decision === "승인완료" ? "신규 자산 요청 승인 완료" : "신규 자산 요청 반려",
      description:
        decision === "승인완료"
          ? `${req.name} (${req.no}) 요청을 승인하고 관리 대상으로 등록했습니다.`
          : `${req.name} (${req.no}) 요청을 반려했습니다.`,
      asset: req.name,
      owner: req.owner,
      status: "완료",
      urgent: false,
      link_view: decision === "승인완료" ? "assets" : "request",
      link_label: decision === "승인완료" ? "자산 목록에서 보기" : "요청 내역 확인",
    })
    refreshNotifications()

    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, approval: decision } : r)),
    )
    setBusyId(null)

    if (decision === "승인완료") {
      toast({
        tone: "success",
        title: "신규 자산 요청 승인 완료",
        description: `${req.name} (${req.no}) 요청을 승인하고 관리 대상으로 등록했습니다.`,
      })
    } else {
      toast({
        tone: "danger",
        title: "신규 자산 요청 반려",
        description: `${req.name} (${req.no}) 요청을 반려했습니다. 요청자에게 사유가 통보됩니다.`,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardCheck}
        title="승인 현황"
        description="사용자가 요청한 신규 SW 자산을 관리자가 검토하고 승인 또는 반려합니다. 승인 시 공식 관리 대상으로 등록됩니다."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="승인 대기" value={counts.pending} icon={Clock3} risk={3} delay={80} />
        <StatCard label="승인 완료" value={counts.approved} icon={CircleCheck} risk={1} delay={180} />
        <StatCard label="반려" value={counts.rejected} icon={CircleX} risk={5} delay={280} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Request list */}
        <div className="lg:col-span-3">
          <SectionCard
            title="요청 목록"
            subtitle="신규 자산 등록 요청 검토"
            icon={ClipboardCheck}
            action={
              <ExportExcelButton
                rows={filtered}
                filename="신규_자산_요청_승인"
                columns={[
                  { label: "요청번호", value: (r: AssetRequest) => r.no },
                  { label: "제품명", value: (r: AssetRequest) => r.name },
                  { label: "벤더", value: (r: AssetRequest) => r.vendor },
                  { label: "요청자", value: (r: AssetRequest) => r.requester },
                  { label: "요청일", value: (r: AssetRequest) => formatDate(r.created_at) },
                  { label: "상태", value: (r: AssetRequest) => r.approval },
                ]}
              />
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setFilter(f); pagination.setPage(1) }}
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
                {pagination.pageItems.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-accent/40",
                      selectedId === r.id ? "bg-primary/10" : "",
                    )}
                  >
                    <Td className="font-mono text-xs text-muted-foreground">{r.no}</Td>
                    <Td className="font-semibold">{r.name}</Td>
                    <Td>{r.requester}</Td>
                    <Td className="text-xs text-muted-foreground">{formatDate(r.created_at)}</Td>
                    <Td>
                      <StatusBadge risk={approvalRisk[r.approval]}>{r.approval}</StatusBadge>
                    </Td>
                    <Td>
                      {r.approval === "승인대기" || r.approval === "검토중" ? (
                        <div className="flex items-center gap-1.5">
                          <MiniButton
                            accent="success"
                            disabled={!!busyId}
                            onClick={(e) => {
                              e.stopPropagation()
                              decide(r, "승인완료")
                            }}
                          >
                            <Check className="h-3 w-3" />승인
                          </MiniButton>
                          <MiniButton
                            accent="destructive"
                            disabled={!!busyId}
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
                            setSelectedId(r.id)
                          }}
                        >
                          <Eye className="h-3 w-3" />상세
                        </MiniButton>
                      )}
                    </Td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
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
            {!loading && filtered.length > 0 && (
              <div className="mt-3">
                <Pagination
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </div>
            )}
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
                  <StatusBadge risk={approvalRisk[selected.approval]}>
                    {selected.approval}
                  </StatusBadge>
                </div>

                <dl className="grid grid-cols-1 gap-2.5">
                  <DetailRow icon={User} label="요청자" value={`${selected.requester} · ${selected.requester_dept}`} />
                  <DetailRow icon={Server} label="설치 서버" value={selected.server} />
                  <DetailRow icon={CalendarClock} label="요청일시" value={formatDate(selected.created_at)} />
                  <DetailRow
                    icon={Flag}
                    label="긴급도"
                    value={selected.urgency}
                    warn={selected.urgency === "긴급"}
                  />
                </dl>

                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">요청 사유</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{selected.reason}</p>
                </div>

                {selected.approval === "승인대기" || selected.approval === "검토중" ? (
                  <div className="flex gap-2">
                    <MiniButton
                      accent="success"
                      disabled={!!busyId}
                      onClick={() => decide(selected, "승인완료")}
                      className="flex-1 justify-center rounded-lg py-2.5 text-sm"
                    >
                      <Check className="h-4 w-4" />
                      {busyId === selected.id ? "처리 중..." : "승인"}
                    </MiniButton>
                    <MiniButton
                      accent="destructive"
                      disabled={!!busyId}
                      onClick={() => decide(selected, "반려")}
                      className="flex-1 justify-center rounded-lg py-2.5 text-sm"
                    >
                      <X className="h-4 w-4" />
                      {busyId === selected.id ? "처리 중..." : "반려"}
                    </MiniButton>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
                      selected.approval === "승인완료"
                        ? "border-risk-1/30 bg-risk-1/10 text-risk-1"
                        : "border-risk-5/30 bg-risk-5/10 text-risk-5",
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
                {loading ? "불러오는 중…" : "왼쪽 목록에서 요청을 선택하면 상세 정보가 표시됩니다."}
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
          warn ? "text-risk-5" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}
