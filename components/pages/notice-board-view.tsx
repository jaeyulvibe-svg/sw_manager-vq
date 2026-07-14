"use client"

import { Fragment, useEffect, useState } from "react"
import {
  Megaphone,
  Search,
  Plus,
  Pencil,
  Save,
  Check,
  Trash2,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  ExportExcelButton,
  SortTh,
  ColumnVisibilityMenu,
  loadColumnVisibility,
  TABLE_HEADER_CELL_H,
  TABLE_ROW_CELL_H,
  usePagination,
  Pagination,
  ConfirmDialog,
  SelectionActionBar,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"
import { useUnsavedGuard } from "@/components/portal/unsaved-guard"
import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type Notice = Tables<"notices">
type NoticeStatus = Notice["status"]

const NOTICE_CATEGORIES = ["시스템", "운영", "승인", "보고서"] as const
const NOTICE_STATUSES: NoticeStatus[] = ["일반", "중요", "긴급"]

const statusRisk: Record<NoticeStatus, RiskLevel | undefined> = {
  일반: undefined,
  중요: 3,
  긴급: 5,
}

/* ---- Shared input style for inline add/edit form ---- */
const inputCls =
  "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

type NoticeFormValues = Omit<Notice, "id" | "views" | "created_at">

const EMPTY_NOTICE_FORM: NoticeFormValues = {
  category: NOTICE_CATEGORIES[0],
  title: "",
  author: "",
  status: "일반",
  content: "",
}

/* ---- Inline add/edit form ---- */
function NoticeFormPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: NoticeFormValues
  onCancel: () => void
  onSubmit: (values: NoticeFormValues) => void
}) {
  const [values, setValues] = useState<NoticeFormValues>(initial ?? EMPTY_NOTICE_FORM)

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">구분</span>
          <select
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            className={inputCls}
          >
            {NOTICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-2">
          <span className="font-medium text-muted-foreground">제목</span>
          <input
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="예: 정기 점검 안내"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">작성자</span>
          <input
            value={values.author}
            onChange={(e) => setValues((v) => ({ ...v, author: e.target.value }))}
            placeholder="예: 관리자"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">상태</span>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as NoticeStatus }))}
            className={inputCls}
          >
            {NOTICE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">본문</span>
        <textarea
          value={values.content}
          onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
          placeholder="공지 본문 내용을 입력하세요"
          rows={5}
          className={cn(inputCls, "resize-y")}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => values.title.trim() && values.author.trim() && onSubmit(values)}
          disabled={!values.title.trim() || !values.author.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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

/* ---- 제목 클릭 시 열리는 상세/편집 패널 ---- */
type NoticeDraft = { title: string; content: string; status: NoticeStatus }

function NoticeDetailPanel({
  notice,
  isAdmin,
  editMode,
  draft,
  saving,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onClose,
  onDeleteRequest,
}: {
  notice: Notice
  isAdmin: boolean
  editMode: boolean
  draft: NoticeDraft | null
  saving: boolean
  onDraftChange: (next: NoticeDraft) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onClose: () => void
  onDeleteRequest: () => void
}) {
  const view: NoticeDraft =
    editMode && draft ? draft : { title: notice.title, content: notice.content, status: notice.status }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">제목</span>
        {editMode ? (
          <input
            value={view.title}
            onChange={(e) => onDraftChange({ ...view, title: e.target.value })}
            className={inputCls}
          />
        ) : (
          <p className="text-sm font-semibold text-foreground">{view.title}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>작성자 {notice.author}</span>
        <span>작성일 {new Date(notice.created_at).toLocaleDateString("ko-KR")}</span>
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        {editMode ? (
          <select
            value={view.status}
            onChange={(e) => onDraftChange({ ...view, status: e.target.value as NoticeStatus })}
            className={cn(inputCls, "w-32")}
          >
            {NOTICE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <StatusBadge risk={statusRisk[view.status]} pulse={view.status === "긴급"}>
            {view.status}
          </StatusBadge>
        )}
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">공지 내용</span>
        {editMode ? (
          <textarea
            value={view.content}
            onChange={(e) => onDraftChange({ ...view, content: e.target.value })}
            rows={6}
            className={cn(inputCls, "resize-y")}
          />
        ) : (
          <p className="whitespace-pre-wrap text-xs text-foreground/90">
            {view.content || "등록된 본문 내용이 없습니다."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editMode ? (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !view.title.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-3 w-3" />
              저장
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              취소
            </button>
          </>
        ) : (
          <>
            {isAdmin ? (
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
              >
                <Pencil className="h-3 w-3" />
                수정
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-3 w-3" />
              확인
            </button>
            {isAdmin ? (
              <button
                type="button"
                onClick={onDeleteRequest}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
                삭제
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/* ---- 컬럼 정의 + 정렬 ---- */
type NoticeColKey = "title" | "author" | "created_at" | "views" | "status"
type ToggleableColKey = Exclude<NoticeColKey, "title">
const NOTICE_ALL_COLS: { key: ToggleableColKey; label: string }[] = [
  { key: "author", label: "작성자" },
  { key: "created_at", label: "등록일" },
  { key: "views", label: "조회수" },
  { key: "status", label: "상태" },
]
const NOTICE_FACTORY_VISIBLE: ToggleableColKey[] = NOTICE_ALL_COLS.map((c) => c.key)
const NOTICE_LS_KEY = "notice_board_columns"

type NoticeSortKey = NoticeColKey | "none"
const noticeStatusOrder: Record<NoticeStatus, number> = { 긴급: 0, 중요: 1, 일반: 2 }

function noticeSortValue(n: Notice, key: NoticeSortKey): string | number {
  if (key === "status") return noticeStatusOrder[n.status]
  if (key === "none") return 0
  return n[key]
}

export function NoticeBoardView() {
  const { isAdmin } = useRole()
  const { setDirty, confirmLeave } = useUnsavedGuard()
  const { toast } = useToast()

  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<NoticeSortKey>("created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [visible, setVisible] = useState<ToggleableColKey[]>(() => loadColumnVisibility(NOTICE_LS_KEY, NOTICE_FACTORY_VISIBLE))

  const [panel, setPanel] = useState<"add" | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteRequest, setDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)

  const [openId, setOpenId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<NoticeDraft | null>(null)
  const [saving, setSaving] = useState(false)

  function loadNotices() {
    const supabase = createClient()
    supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotices(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadNotices()
  }, [])

  function handleSort(col: NoticeSortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
  }

  const searched = notices.filter((n) => {
    const q = query.trim().toLowerCase()
    return !q || [n.title, n.author].some((f) => f.toLowerCase().includes(q))
  })

  const noRank = new Map<string, number>()
  ;[...searched]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((n, i) => noRank.set(n.id, i + 1))

  const filtered = [...searched].sort((a, b) => {
    const va = noticeSortValue(a, sortKey)
    const vb = noticeSortValue(b, sortKey)
    const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
    return sortDir === "asc" ? d : -d
  })

  const show = (key: ToggleableColKey) => visible.includes(key)
  const pagination = usePagination(filtered)

  async function saveNotice(values: NoticeFormValues) {
    const supabase = createClient()
    const payload: TablesInsert<"notices"> = { ...values }
    const { error } = await supabase.from("notices").insert(payload)
    if (error) {
      toast({ title: "공지 등록 실패", description: error.message, tone: "danger" })
      return
    }
    toast({ title: "공지사항이 등록되었습니다", tone: "success" })
    setPanel(null)
    loadNotices()
  }

  function handleTitleClick(id: string) {
    if (editMode && !confirmLeave()) return
    setOpenId((prev) => (prev === id ? null : id))
    setEditMode(false)
    setDraft(null)
    setDirty(false)
  }

  function handleStartEdit(n: Notice) {
    setDraft({ title: n.title, content: n.content, status: n.status })
    setEditMode(true)
    setDirty(false)
  }

  function handleDraftChange(next: NoticeDraft, original: Notice) {
    setDraft(next)
    setDirty(
      next.title !== original.title ||
        next.content !== original.content ||
        next.status !== original.status,
    )
  }

  function handleCancelEdit() {
    setEditMode(false)
    setDraft(null)
    setDirty(false)
  }

  async function handleSave() {
    if (!draft || !openId) return
    if (!draft.title.trim()) {
      toast({ title: "제목을 입력해주세요", tone: "danger" })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("notices")
      .update({ title: draft.title, content: draft.content, status: draft.status })
      .eq("id", openId)
    setSaving(false)
    if (error) {
      toast({ title: "공지 수정 실패", description: error.message, tone: "danger" })
      return
    }
    toast({ title: "공지사항이 수정되었습니다", tone: "success" })
    setEditMode(false)
    setDraft(null)
    setDirty(false)
    loadNotices()
  }

  function handleClosePanel() {
    if (editMode && !confirmLeave()) return
    setOpenId(null)
    setEditMode(false)
    setDraft(null)
    setDirty(false)
  }

  function requestDeleteNotice(n: Notice) {
    setDeleteRequest({
      ids: [n.id],
      title: `"${n.title}"을(를) 삭제할까요?`,
      confirmLabel: "삭제",
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
    const supabase = createClient()
    const { error } = await supabase.from("notices").delete().in("id", deleteRequest.ids)
    if (error) {
      toast({ title: "삭제 실패", description: error.message, tone: "danger" })
      setDeleteRequest(null)
      return
    }
    toast({ title: `공지 ${deleteRequest.ids.length}건이 삭제되었습니다`, tone: "info" })
    if (openId && deleteRequest.ids.includes(openId)) {
      setOpenId(null)
      setEditMode(false)
      setDraft(null)
    }
    setSelectedIds(new Set())
    setDeleteRequest(null)
    loadNotices()
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map((n) => n.id)),
    )
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

  // +1 은 NO 컬럼, +1 은 제목 컬럼(둘 다 컬럼설정에서 숨길 수 없는 고정 컬럼)
  const colSpan = visible.length + 2 + (isAdmin ? 1 : 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Megaphone}
        title="공지사항"
        description={
          isAdmin
            ? "시스템 운영·점검·자산 등록 기준·패치 승인 절차 등을 안내하는 공지사항을 관리합니다."
            : "시스템 운영·점검·자산 등록 기준·패치 승인 절차 안내를 확인합니다."
        }
      />

      <SectionCard
        title="공지 목록"
        subtitle="등록된 공지사항"
        icon={Megaphone}
        action={
          panel ? null : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                  placeholder="제목, 작성자 검색"
                  className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <ExportExcelButton
                rows={filtered}
                filename="공지사항"
                columns={[
                  { label: "NO", value: (n: Notice) => noRank.get(n.id) ?? "" },
                  { label: "제목", value: (n: Notice) => n.title },
                  { label: "작성자", value: (n: Notice) => n.author },
                  { label: "등록일", value: (n: Notice) => new Date(n.created_at).toLocaleDateString("ko-KR") },
                  { label: "조회수", value: (n: Notice) => n.views },
                  { label: "상태", value: (n: Notice) => n.status },
                ]}
              />
              <ColumnVisibilityMenu
                allCols={NOTICE_ALL_COLS}
                visible={visible}
                onChange={setVisible}
                factoryDefault={NOTICE_FACTORY_VISIBLE}
                storageKey={NOTICE_LS_KEY}
              />
              {isAdmin ? (
                <MiniButton accent="primary" onClick={() => setPanel("add")}>
                  <Plus className="h-3.5 w-3.5" />
                  추가
                </MiniButton>
              ) : null}
            </div>
          )
        }
      >
        {panel === "add" ? (
          <NoticeFormPanel onCancel={() => setPanel(null)} onSubmit={saveNotice} />
        ) : null}

        {isAdmin ? (
          <SelectionActionBar count={selectedIds.size} onClear={clearSelection} onDelete={requestDeleteSelected} />
        ) : null}

        <TableShell scrollHint>
          <thead>
            <tr>
              {isAdmin ? (
                <Th className={cn("w-8", TABLE_HEADER_CELL_H)}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    aria-label="전체 선택"
                    className="h-4 w-4 rounded border-border/60 accent-primary"
                  />
                </Th>
              ) : null}
              <Th className={cn("w-12", TABLE_HEADER_CELL_H)}>NO</Th>
              <SortTh col="title" label="제목" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {show("author") && <SortTh col="author" label="작성자" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("created_at") && <SortTh col="created_at" label="등록일" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("views") && <SortTh col="views" label="조회수" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />}
              {show("status") && <SortTh col="status" label="상태" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="center" />}
            </tr>
          </thead>
          <tbody>
            {!loading && notices.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">등록된 공지사항이 없습니다.</span>
                </Td>
              </tr>
            ) : (
              pagination.pageItems.map((n) => {
                const isOpen = openId === n.id
                return (
                  <Fragment key={n.id}>
                    <tr className="transition-colors hover:bg-accent/40">
                      {isAdmin ? (
                        <Td className={TABLE_ROW_CELL_H}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(n.id)}
                            onChange={() => toggleSelected(n.id)}
                            aria-label={`${n.title} 선택`}
                            className="h-4 w-4 rounded border-border/60 accent-primary"
                          />
                        </Td>
                      ) : null}
                      <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>
                        {noRank.get(n.id) ?? "-"}
                      </Td>
                      <Td className={cn("max-w-xs", TABLE_ROW_CELL_H)}>
                        <button
                          type="button"
                          onClick={() => handleTitleClick(n.id)}
                          aria-expanded={isOpen}
                          aria-controls={`notice-panel-${n.id}`}
                          className="line-clamp-2 whitespace-normal text-left font-medium text-foreground underline-offset-2 hover:text-primary hover:underline focus:underline focus:outline-none"
                        >
                          {n.title}
                        </button>
                      </Td>
                      {show("author") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{n.author}</Td>}
                      {show("created_at") && (
                        <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>
                          {new Date(n.created_at).toLocaleDateString("ko-KR")}
                        </Td>
                      )}
                      {show("views") && (
                        <Td className={cn("text-right font-mono tabular-nums text-muted-foreground", TABLE_ROW_CELL_H)}>
                          {n.views.toLocaleString()}
                        </Td>
                      )}
                      {show("status") && (
                        <Td className={TABLE_ROW_CELL_H}>
                          <StatusBadge risk={statusRisk[n.status]} pulse={n.status === "긴급"}>
                            {n.status}
                          </StatusBadge>
                        </Td>
                      )}
                    </tr>
                    {isOpen ? (
                      <tr id={`notice-panel-${n.id}`}>
                        <td colSpan={colSpan} className="border-b border-border/40 bg-background/40 p-3">
                          <NoticeDetailPanel
                            notice={n}
                            isAdmin={isAdmin}
                            editMode={editMode}
                            draft={draft}
                            saving={saving}
                            onDraftChange={(next) => handleDraftChange(next, n)}
                            onStartEdit={() => handleStartEdit(n)}
                            onCancelEdit={handleCancelEdit}
                            onSave={handleSave}
                            onClose={handleClosePanel}
                            onDeleteRequest={() => requestDeleteNotice(n)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </TableShell>
        {loading ? <p className="mt-2 text-xs text-muted-foreground">불러오는 중…</p> : null}
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

      <ConfirmDialog
        open={!!deleteRequest}
        title={deleteRequest?.title ?? ""}
        description="삭제 후에는 목록에서 제거됩니다."
        confirmLabel={deleteRequest?.confirmLabel ?? ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRequest(null)}
      />
    </div>
  )
}
