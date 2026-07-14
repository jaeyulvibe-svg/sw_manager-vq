// components/pages/notice-board/notice-review-board.tsx
"use client"

import { useEffect, useState } from "react"
import {
  ExternalLink,
  Link2,
  Check,
  X,
  Server,
  ArrowRight,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  MiniButton,
  usePagination,
  Pagination,
  ConfirmDialog,
  SelectionActionBar,
  type Accent,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useNotifications } from "@/components/portal/notifications-context"
import { useToast } from "@/components/portal/toast"
import type { ViewKey } from "@/components/portal/nav"
import { useNoticeData, sevRisk, formatCollected, type Vulnerability } from "./use-notice-data"
import { approveNotice, rejectNotice, deleteNotices } from "./notice-actions"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Severity = Vulnerability["severity"]
type Status = Vulnerability["approval"]

const FILTERS = ["전체", "Critical", "High", "Medium", "Low", "미매핑", "승인대기"] as const

const statusAccent: Record<Status, Accent> = {
  반려: "destructive", 승인대기: "primary", 검토중: "review", 승인완료: "success",
}

function toUrl(sourceUrl: string) {
  return /^https?:\/\//.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`
}

export function NoticeReviewBoard({
  sourceType,
  noticeTypes,
  title,
  description,
  icon: Icon,
  onNavigate,
  initialPageSize = 10,
  pageSizeOptions,
}: {
  sourceType?: "kisa" | "vendor"
  noticeTypes: Vulnerability["notice_type"][]
  title: string
  description: string
  icon: LucideIcon
  onNavigate?: (view: ViewKey) => void
  initialPageSize?: number
  pageSizeOptions?: readonly number[]
}) {
  const { isAdmin } = useRole()
  const { toast } = useToast()
  const { refresh: refreshNotifications } = useNotifications()
  const { vulns, setVulns, matchMap, loading, refresh } = useNoticeData({ sourceType, noticeTypes })

  const [query, setQuery] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [criticalUrgentAlert, setCriticalUrgentAlert] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteRequest, setDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("admin_policies")
      .select("critical_urgent_alert")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCriticalUrgentAlert(data.critical_urgent_alert)
      })
  }, [])

  const filtered = vulns.filter((v) => {
    const q = query.trim().toLowerCase()
    if (q && ![v.title, v.cve].some((f) => f.toLowerCase().includes(q))) return false
    const count = matchMap.get(v.id)?.length ?? 0
    if (filter === "전체") return true
    if (filter === "미매핑") return count === 0
    if (filter === "승인대기") return v.approval === "승인대기"
    return v.severity === filter
  })

  const pagination = usePagination(filtered, initialPageSize)

  const selected = vulns.find((v) => v.id === selectedId) ?? vulns[0]
  const selectedMatches = selected ? matchMap.get(selected.id) ?? [] : []

  async function handleApprove(v: Vulnerability) {
    if (busyId) return
    setBusyId(v.id)
    const matched = matchMap.get(v.id) ?? []
    const { notifiedCount } = await approveNotice(v, matched, { criticalUrgentAlert })

    setVulns((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, approval: "승인완료", mapped_assets: matched.length } : x)),
    )
    if (notifiedCount > 0) refreshNotifications()
    setBusyId(null)
    toast({
      tone: "success",
      title: "승인 완료",
      description:
        notifiedCount > 0
          ? `매칭된 자산 ${notifiedCount}대의 담당자에게 패치 권고를 전달했습니다.`
          : "매칭된 자산이 없어 별도 알림은 발송되지 않았습니다.",
    })
  }

  async function handleReject(v: Vulnerability) {
    if (busyId) return
    setBusyId(v.id)
    await rejectNotice(v)
    setVulns((prev) => prev.map((x) => (x.id === v.id ? { ...x, approval: "반려" } : x)))
    setBusyId(null)
    toast({ tone: "info", title: "공지 반려", description: `"${v.title}" 공지를 반려 처리했습니다.` })
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function clearSelection() {
    setSelectedIds(new Set())
  }
  function requestDeleteOne(v: Vulnerability) {
    setDeleteRequest({
      ids: [v.id],
      title: `"${v.title}" 공지를 삭제할까요?`,
      confirmLabel: "1개 삭제",
    })
  }
  function requestDeleteSelected() {
    if (selectedIds.size === 0) return
    setDeleteRequest({
      ids: Array.from(selectedIds),
      title: `선택한 공지 ${selectedIds.size}개를 삭제할까요?`,
      confirmLabel: `${selectedIds.size}개 삭제`,
    })
  }
  async function confirmDelete() {
    if (!deleteRequest) return
    const { error } = await deleteNotices(deleteRequest.ids)
    if (error) {
      toast({ title: "삭제 실패", description: error, tone: "danger" })
      setDeleteRequest(null)
      return
    }
    toast({ title: `공지 ${deleteRequest.ids.length}건이 삭제되었습니다`, tone: "info" })
    if (deleteRequest.ids.includes(selectedId ?? "")) setSelectedId(null)
    setSelectedIds(new Set())
    setDeleteRequest(null)
    refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Icon} title={title} description={description} />

      <div className="glow-card animate-rise flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
              placeholder="제목, CVE 검색"
              className="w-full rounded-lg border border-border/60 bg-background/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <MiniButton
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(filtersOpen && "border-primary/50 bg-primary/10 text-primary")}
          >
            <Filter className="h-3.5 w-3.5" />
            필터{filter !== "전체" ? ` (${filter})` : ""}
            {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </MiniButton>
        </div>

        {filtersOpen ? (
          <div className="animate-rise flex flex-wrap gap-2 border-t border-border/50 pt-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFilter(f); pagination.setPage(1) }}
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
        ) : null}
      </div>

      {isAdmin ? (
        <SelectionActionBar count={selectedIds.size} onClear={clearSelection} onDelete={requestDeleteSelected} />
      ) : null}

      {!loading && vulns.length === 0 ? (
        <SectionCard title="공지 없음" icon={Icon}>
          <p className="text-sm text-muted-foreground">수집된 취약점 공지가 없습니다.</p>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-3 lg:col-span-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : (
              pagination.pageItems.map((n) => {
                const matchedCount = matchMap.get(n.id)?.length ?? 0
                return (
                  <div key={n.id} className="relative">
                    {isAdmin ? (
                      <span
                        className="absolute left-4 top-4 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(n.id)}
                          onChange={() => toggleSelected(n.id)}
                          aria-label={`${n.title} 선택`}
                          className="h-4 w-4 rounded border-border/60 accent-primary"
                        />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className={cn(
                        "group animate-rise relative w-full rounded-2xl border border-border/60 bg-card p-4 text-left transition-all glow-card hover:-translate-y-0.5",
                        isAdmin && "pl-10",
                        selectedId === n.id && "bg-primary/5",
                      )}
                    >
                    {selectedId === n.id ? (
                      <span
                        className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge risk={sevRisk[n.severity]} pulse={n.severity === "Critical"}>
                        {n.severity}
                      </StatusBadge>
                      <span className="font-mono text-xs text-muted-foreground">{n.cve}</span>
                      {matchedCount === 0 ? (
                        <StatusBadge accent="muted">미매핑</StatusBadge>
                      ) : null}
                      <StatusBadge accent={statusAccent[n.approval]} className="ml-auto">
                        {n.approval}
                      </StatusBadge>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{n.source}</span>
                      <span className="flex items-center gap-1"><Server className="h-3 w-3" />영향 {n.product}</span>
                      <span>{n.approval === "승인완료" ? `자산 매핑 확정 ${matchedCount}대` : `영향받는 자산 ${matchedCount}대`}</span>
                      <span className="ml-auto">{formatCollected(n.collected_at)}</span>
                    </div>
                    </button>
                  </div>
                )
              })
            )}
            {!loading && filtered.length > 0 ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={pageSizeOptions}
              />
            ) : null}
          </div>

          {selected ? (
            <div className="lg:col-span-2">
              <SectionCard title="공지 상세" subtitle={selected.cve} icon={Icon}>
                <div className="flex flex-col gap-4">
                  <div>
                    <StatusBadge risk={sevRisk[selected.severity]} pulse={selected.severity === "Critical"}>
                      {selected.severity}
                    </StatusBadge>
                    <h4 className="mt-2 text-sm font-bold text-foreground">{selected.title}</h4>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      ["수집 Source", selected.source],
                      ["CVE ID", selected.cve],
                      ["영향 제품", selected.product],
                      ["수집 일시", formatCollected(selected.collected_at)],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0 rounded-lg border border-border/60 bg-background/40 p-2.5">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="mt-0.5 break-words font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Server className="h-3.5 w-3.5 text-primary" />
                      {selected.approval === "승인완료"
                        ? `자산 매핑 확정 ${selectedMatches.length}대`
                        : `영향받는 자산 ${selectedMatches.length}대 (승인 전)`}
                    </p>
                    {selectedMatches.length > 0 ? (
                      <>
                        <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          {selectedMatches.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5">
                              <span className="min-w-0 truncate font-mono">{a.id} · {a.server}</span>
                              <span className="shrink-0">{a.owner}</span>
                            </li>
                          ))}
                        </ul>
                        {selected.approval !== "승인완료" ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            제품명 기준으로 자동 매칭된 실제 보유 자산입니다. 관리자가 승인해야 확정되며, 승인 전까지는 담당자에게 전달되지 않습니다.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        현재 보유 자산 중 매칭되는 항목이 없습니다.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selected.source_url ? (
                      <MiniButton accent="primary" onClick={() => window.open(toUrl(selected.source_url!), "_blank")}>
                        <ExternalLink className="h-3 w-3" />원문 보기
                      </MiniButton>
                    ) : null}
                    {isAdmin ? (
                      selected.approval === "승인완료" || selected.approval === "반려" ? (
                        <StatusBadge risk={selected.approval === "승인완료" ? 1 : 5}>
                          {selected.approval === "승인완료" ? "승인 완료 · 담당자 전달됨" : "반려됨"}
                        </StatusBadge>
                      ) : (
                        <>
                          <MiniButton
                            accent="success"
                            disabled={!!busyId}
                            onClick={() => handleApprove(selected)}
                          >
                            <Check className="h-3 w-3" />
                            {busyId === selected.id ? "처리 중..." : "승인 및 담당자 전달"}
                          </MiniButton>
                          <MiniButton
                            accent="destructive"
                            disabled={!!busyId}
                            onClick={() => handleReject(selected)}
                          >
                            <X className="h-3 w-3" />
                            {busyId === selected.id ? "처리 중..." : "반려"}
                          </MiniButton>
                        </>
                      )
                    ) : null}
                    {selected.approval === "승인완료" && onNavigate ? (
                      <MiniButton accent="eos" onClick={() => onNavigate("patch")}>
                        <ArrowRight className="h-3 w-3" />패치&취약점&EOS공지에서 보기
                      </MiniButton>
                    ) : null}
                    {isAdmin ? (
                      <MiniButton accent="destructive" onClick={() => requestDeleteOne(selected)}>
                        <Trash2 className="h-3 w-3" />삭제
                      </MiniButton>
                    ) : null}
                  </div>
                  {!isAdmin ? (
                    <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                      사용자는 관리자의 승인 후 배정된 자산에 대한 알림을 확인합니다.
                    </p>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteRequest}
        title={deleteRequest?.title ?? ""}
        description="삭제 후에는 목록에서 제거됩니다. 이미 승인 완료되어 자산과 매핑된 공지가 포함되어 있다면 관련 정보에 영향을 줄 수 있습니다."
        confirmLabel={deleteRequest?.confirmLabel ?? ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRequest(null)}
      />
    </div>
  )
}
