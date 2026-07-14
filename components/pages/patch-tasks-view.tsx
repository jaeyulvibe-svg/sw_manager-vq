// components/pages/patch-tasks-view.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ListChecks,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Search,
  Pencil,
  Check,
  X,
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
  usePagination,
  Pagination,
  type Accent,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"
import { useNoticeData, sevRisk, type Vulnerability } from "@/components/pages/notice-board/use-notice-data"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type PatchTask = Tables<"patch_tasks">
type PatchTaskStatus = PatchTask["status"]
type Asset = Tables<"assets">

const STATUS_FILTERS: ("전체" | PatchTaskStatus)[] = ["전체", "배정됨", "조치예정", "조치지연", "조치완료", "예외요청", "예외승인"]
const SEVERITY_FILTERS: ("전체" | Vulnerability["severity"])[] = ["전체", "Critical", "High", "Medium", "Low"]
const EDIT_STATUS_OPTIONS: PatchTaskStatus[] = ["조치예정", "조치지연", "조치완료", "예외요청"]

const statusAccent: Record<PatchTaskStatus, Accent> = {
  배정됨: "muted",
  조치예정: "primary",
  조치지연: "warning",
  조치완료: "success",
  예외요청: "review",
  예외승인: "muted",
}

type Row = { task: PatchTask; vulnerability: Vulnerability; asset: Asset }

type EditValues = { status: PatchTaskStatus; due_date: string; note: string }

function EditPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: EditValues
  onCancel: () => void
  onSubmit: (values: EditValues) => void
}) {
  const [values, setValues] = useState<EditValues>(initial)
  const inputCls =
    "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        <select
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as PatchTaskStatus }))}
          className={inputCls}
        >
          {EDIT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">기한</span>
        <input
          type="date"
          value={values.due_date}
          onChange={(e) => setValues((v) => ({ ...v, due_date: e.target.value }))}
          className={inputCls}
        />
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">메모 (계획/지연사유/조치내용)</span>
        <textarea
          value={values.note}
          onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
          rows={2}
          className={cn(inputCls, "resize-none")}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(values)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          취소
        </button>
      </div>
    </div>
  )
}

export function PatchTasksView() {
  const { isAdmin, currentUser } = useRole()
  const { toast } = useToast()
  const { vulns, assets, loading: noticeLoading } = useNoticeData()
  const [tasks, setTasks] = useState<PatchTask[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"전체" | PatchTaskStatus>("전체")
  const [severityFilter, setSeverityFilter] = useState<"전체" | Vulnerability["severity"]>("전체")
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("patch_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTasks(data)
        setLoading(false)
      })
  }, [])

  const vulnMap = useMemo(() => new Map(vulns.map((v) => [v.id, v])), [vulns])
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const task of tasks) {
      const vulnerability = vulnMap.get(task.vulnerability_id)
      const asset = assetMap.get(task.asset_id)
      if (vulnerability && asset) out.push({ task, vulnerability, asset })
    }
    return out
  }, [tasks, vulnMap, assetMap])

  const filtered = rows.filter(({ task, vulnerability }) => {
    const q = query.trim().toLowerCase()
    if (q && ![vulnerability.title, vulnerability.cve].some((f) => f.toLowerCase().includes(q))) return false
    if (currentUser?.role === "담당자" && task.owner !== currentUser.name) return false
    if (statusFilter !== "전체" && task.status !== statusFilter) return false
    if (severityFilter !== "전체" && vulnerability.severity !== severityFilter) return false
    return true
  })

  const stats = useMemo(
    () => ({
      total: rows.length,
      scheduled: rows.filter((r) => r.task.status === "조치예정").length,
      delayed: rows.filter((r) => r.task.status === "조치지연").length,
      done: rows.filter((r) => r.task.status === "조치완료").length,
    }),
    [rows],
  )

  const pagination = usePagination(filtered)

  async function saveTask(taskId: string, values: EditValues) {
    if (values.status === "조치예정" && !values.due_date) {
      toast({ tone: "danger", title: "기한을 입력해주세요", description: "조치예정 상태는 기한이 필수입니다." })
      return
    }
    if (values.status === "예외요청" && !values.note.trim()) {
      toast({ tone: "danger", title: "사유를 입력해주세요", description: "예외요청은 메모(사유)가 필수입니다." })
      return
    }
    const supabase = createClient()
    const patch = {
      status: values.status,
      due_date: values.due_date || null,
      note: values.note || null,
      completed_at: values.status === "조치완료" ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from("patch_tasks").update(patch).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "저장 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
    setEditId(null)
    toast({ tone: "success", title: "조치 내용이 저장되었습니다" })
  }

  async function approveException(taskId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("patch_tasks").update({ status: "예외승인" }).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "승인 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "예외승인" } : t)))
    toast({ tone: "success", title: "예외요청을 승인했습니다" })
  }

  async function rejectException(taskId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("patch_tasks").update({ status: "조치예정" }).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "반려 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "조치예정" } : t)))
    toast({ tone: "success", title: "예외요청을 반려했습니다" })
  }

  const isLoading = loading || noticeLoading

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ListChecks}
        title="내 조치 업무"
        description="승인된 취약점·EOS 공지에서 배정된 자산별 조치 건을 확인하고 계획·지연사유·완료를 등록합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 배정" value={stats.total} icon={ClipboardList} accent="primary" delay={80} />
        <StatCard label="조치예정" value={stats.scheduled} icon={CalendarClock} accent="primary" delay={160} />
        <StatCard label="조치지연" value={stats.delayed} icon={AlertTriangle} accent="warning" delay={240} />
        <StatCard label="조치완료" value={stats.done} icon={CheckCircle2} accent="success" delay={320} />
      </div>

      <SectionCard title="조치 목록" subtitle="공지 승인 시 매칭된 자산마다 자동 생성됩니다" icon={ListChecks}>
        <div className="mb-4 flex flex-col gap-3 border-b border-border/50 pb-4">
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
          </div>
          {currentUser?.role === "담당자" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                담당자: <span className="font-medium text-foreground">{currentUser.name}</span> 님의 조치 건만 표시됩니다.
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">상태</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatusFilter(s); pagination.setPage(1) }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">심각도</span>
            {SEVERITY_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSeverityFilter(s); pagination.setPage(1) }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  severityFilter === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          총 <span className="font-mono font-semibold text-foreground">{filtered.length}</span>건
          {isLoading && <span className="ml-2 text-xs">불러오는 중…</span>}
        </p>

        <TableShell scrollHint>
          <thead>
            <tr>
              <Th>심각도</Th>
              <Th>CVE</Th>
              <Th>제품명</Th>
              <Th>서버명</Th>
              <Th>담당자</Th>
              <Th>상태</Th>
              <Th>기한</Th>
              <Th>메모</Th>
              <Th>관리</Th>
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map(({ task, vulnerability, asset }) => {
              const canEdit = currentUser?.role === "담당자"
              if (editId === task.id) {
                return (
                  <tr key={task.id}>
                    <td colSpan={9} className="border-b border-border/40 p-0">
                      <EditPanel
                        initial={{
                          status: EDIT_STATUS_OPTIONS.includes(task.status as (typeof EDIT_STATUS_OPTIONS)[number])
                            ? (task.status as EditValues["status"])
                            : "조치예정",
                          due_date: task.due_date ?? "",
                          note: task.note ?? "",
                        }}
                        onCancel={() => setEditId(null)}
                        onSubmit={(values) => saveTask(task.id, values)}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={task.id} className="transition-colors hover:bg-accent/40">
                  <Td>
                    <StatusBadge risk={sevRisk[vulnerability.severity]} pulse={vulnerability.severity === "Critical"}>
                      {vulnerability.severity}
                    </StatusBadge>
                  </Td>
                  <Td className="font-mono text-xs">{vulnerability.cve}</Td>
                  <Td className="text-xs">{vulnerability.product}</Td>
                  <Td className="text-xs text-muted-foreground">{asset.server}</Td>
                  <Td className="text-xs">{task.owner}</Td>
                  <Td>
                    <StatusBadge accent={statusAccent[task.status]}>{task.status}</StatusBadge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{task.due_date ?? "-"}</Td>
                  <Td className="max-w-xs truncate text-xs text-muted-foreground">{task.note ?? "-"}</Td>
                  <Td>
                    {isAdmin && task.status === "예외요청" ? (
                      <div className="flex items-center gap-1.5">
                        <MiniButton accent="success" onClick={() => approveException(task.id)}>
                          <Check className="h-3 w-3" />승인
                        </MiniButton>
                        <MiniButton accent="destructive" onClick={() => rejectException(task.id)}>
                          <X className="h-3 w-3" />반려
                        </MiniButton>
                      </div>
                    ) : canEdit ? (
                      <MiniButton accent="primary" onClick={() => setEditId(task.id)}>
                        <Pencil className="h-3 w-3" />
                        조치 등록
                      </MiniButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </Td>
                </tr>
              )
            })}
            {!isLoading && pagination.pageItems.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  검색 조건에 맞는 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </TableShell>

        <div className="mt-3">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      </SectionCard>
    </div>
  )
}
