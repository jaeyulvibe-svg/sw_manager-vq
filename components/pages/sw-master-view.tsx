"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Database,
  Plus,
  Search,
  SlidersHorizontal,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RotateCcw,
  Save,
  AlertTriangle,
  History,
  Loader2,
  Filter,
} from "lucide-react"
import { PageHeader, TableShell, Th, Td, MiniButton, ExportExcelButton } from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { useUnsavedGuard } from "@/components/portal/unsaved-guard"
import { cn } from "@/lib/utils"
import {
  useMasterDraft,
  MASTER_CATEGORIES,
  COLLECT_MODES,
  type EditableFields,
  type EffectiveRow,
} from "@/components/pages/sw-master/use-master-draft"
import {
  EditableText,
  EditableVendor,
  EditableCategory,
  EditableCollectMode,
  ActiveToggle,
  RowStatusBadge,
  RowMenu,
  MasterDetailModal,
  CATEGORY_ICONS,
  CollectModeBadge,
  UseStatusBadge,
  CategoryCell,
} from "@/components/pages/sw-master/cells"

/* ---- 컬럼 정의 ---- */
type ColKey =
  | "id" | "category" | "name" | "std_version" | "vendor" | "collect_mode" | "active" | "created_at"
  | "manager" | "updated_by" | "note"

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "id", label: "마스터 ID" },
  { key: "category", label: "분류" },
  { key: "name", label: "제품명" },
  { key: "std_version", label: "버전" },
  { key: "vendor", label: "제조사" },
  { key: "collect_mode", label: "수집 모드" },
  { key: "active", label: "사용 여부" },
  { key: "created_at", label: "등록일" },
  { key: "manager", label: "관리자" },
  { key: "updated_by", label: "수정자" },
  { key: "note", label: "비고" },
]
const FACTORY_VISIBLE: ColKey[] = [
  "id", "category", "name", "std_version", "vendor", "collect_mode", "active", "created_at",
]
const LS_COLUMNS_KEY = "sw_master_columns"

function loadVisibleCols(): ColKey[] {
  if (typeof window === "undefined") return FACTORY_VISIBLE
  try {
    const raw = window.localStorage.getItem(LS_COLUMNS_KEY)
    if (raw) return JSON.parse(raw) as ColKey[]
  } catch {}
  return FACTORY_VISIBLE
}
function saveVisibleCols(cols: ColKey[]) {
  window.localStorage.setItem(LS_COLUMNS_KEY, JSON.stringify(cols))
}

/* ---- 컬럼 너비 조절 ---- */
const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  id: 140,
  category: 150,
  name: 220,
  std_version: 120,
  vendor: 180,
  collect_mode: 150,
  active: 110,
  created_at: 130,
  manager: 110,
  updated_by: 100,
  note: 160,
}
const MIN_COL_WIDTH = 60
const MAX_COL_WIDTH = 480
const LS_COL_WIDTHS_KEY = "sw_master_col_widths"

function loadColWidths(): Partial<Record<ColKey, number>> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(LS_COL_WIDTHS_KEY)
    if (raw) return JSON.parse(raw) as Partial<Record<ColKey, number>>
  } catch {}
  return {}
}
function saveColWidths(widths: Partial<Record<ColKey, number>>) {
  window.localStorage.setItem(LS_COL_WIDTHS_KEY, JSON.stringify(widths))
}

function ColumnResizeHandle({ onResize }: { onResize: (deltaPx: number) => void }) {
  const lastX = useRef(0)

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    lastX.current = e.clientX

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - lastX.current
      lastX.current = ev.clientX
      onResize(delta)
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  return (
    <span
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/50 active:bg-primary/70"
    />
  )
}

/* ---- 정렬 ---- */
type SortKey = "id" | keyof EditableFields | "created_at"
type SortDir = "asc" | "desc"
type SortSpec = { key: SortKey; dir: SortDir }

function sortValue(row: EffectiveRow, key: SortKey): string | number {
  if (key === "id") return row.id
  if (key === "created_at") return row.createdAt ? new Date(row.createdAt).getTime() : 0
  if (key === "active") return row.values.active ? 1 : 0
  return String(row.values[key as keyof EditableFields])
}

function cycleSort(current: SortSpec[], key: SortKey, additive: boolean): SortSpec[] {
  const idx = current.findIndex((s) => s.key === key)
  if (!additive) {
    if (idx === -1) return [{ key, dir: "asc" }]
    if (current[idx].dir === "asc") return [{ key, dir: "desc" }]
    return []
  }
  if (idx === -1) return [...current, { key, dir: "asc" }]
  if (current[idx].dir === "asc") {
    const next = [...current]
    next[idx] = { key, dir: "desc" }
    return next
  }
  return current.filter((_, i) => i !== idx)
}

function SortTh({
  col,
  label,
  sort,
  onSort,
  width,
  onResize,
}: {
  col: SortKey
  label: string
  sort: SortSpec[]
  onSort: (key: SortKey, additive: boolean) => void
  width: number
  onResize: (deltaPx: number) => void
}) {
  const idx = sort.findIndex((s) => s.key === col)
  const active = idx !== -1
  const dir = active ? sort[idx].dir : undefined
  return (
    <th
      onClick={(e) => onSort(col, e.shiftKey)}
      style={{ width, minWidth: width, maxWidth: width }}
      className={cn(
        "relative cursor-pointer select-none overflow-hidden text-ellipsis whitespace-nowrap border-b border-border/60 bg-accent/15 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-primary/12 text-primary",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          <>
            {dir === "asc" ? (
              <ChevronUp className="h-3 w-3 text-primary" />
            ) : (
              <ChevronDown className="h-3 w-3 text-primary" />
            )}
            {sort.length > 1 ? <span className="text-[9px] text-primary">{idx + 1}</span> : null}
          </>
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
      <ColumnResizeHandle onResize={onResize} />
    </th>
  )
}

const PAGE_SIZES = [10, 20, 50] as const
const CATEGORY_FILTERS = ["전체", ...MASTER_CATEGORIES] as const
const COLLECT_MODE_FILTERS = ["전체", ...COLLECT_MODES] as const
const ACTIVE_FILTERS = ["전체", "사용", "미사용"] as const

export function SwMasterView() {
  const { toast } = useToast()
  const { setDirty } = useUnsavedGuard()
  const draft = useMasterDraft()

  const [query, setQuery] = useState("")
  const [catFilter, setCatFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("전체")
  const [modeFilter, setModeFilter] = useState<(typeof COLLECT_MODE_FILTERS)[number]>("전체")
  const [activeFilter, setActiveFilter] = useState<(typeof ACTIVE_FILTERS)[number]>("전체")
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false)

  const [sort, setSort] = useState<SortSpec[]>([{ key: "id", dir: "asc" }])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState<"" | EditableFields["category"]>("")
  const [bulkMode, setBulkMode] = useState<"" | (typeof COLLECT_MODES)[number]>("")
  const [bulkActive, setBulkActive] = useState<"" | "사용" | "미사용">("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(20)
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => loadVisibleCols())
  const [colWidths, setColWidths] = useState<Partial<Record<ColKey, number>>>(() => loadColWidths())
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  const [detailRow, setDetailRow] = useState<EffectiveRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)

  useEffect(() => {
    setDirty(draft.hasChanges)
  }, [draft.hasChanges, setDirty])
  useEffect(() => () => setDirty(false), [setDirty])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  useEffect(() => {
    if (!editingRowId) return
    function onClickOutside(e: MouseEvent) {
      const el = rowRefs.current.get(editingRowId)
      if (el && !el.contains(e.target as Node)) setEditingRowId(null)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [editingRowId])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 2400)
    return () => clearTimeout(t)
  }, [highlightId])

  const vendorOptions = useMemo(
    () =>
      Array.from(new Set(draft.rows.map((r) => r.values.vendor).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [draft.rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return draft.rows.filter((row) => {
      const matchesQuery =
        !q ||
        [row.id, row.values.name, row.values.vendor, row.values.std_version].some((v) =>
          v.toLowerCase().includes(q),
        )
      const matchesCat = catFilter === "전체" || row.values.category === catFilter
      const matchesMode = modeFilter === "전체" || row.values.collect_mode === modeFilter
      const matchesActive = activeFilter === "전체" || (activeFilter === "사용" ? row.values.active : !row.values.active)
      return matchesQuery && matchesCat && matchesMode && matchesActive
    })
  }, [draft.rows, query, catFilter, modeFilter, activeFilter])

  const detailFilterCount = [catFilter, modeFilter, activeFilter].filter((v) => v !== "전체").length
  const filterChips: { key: string; label: string; onRemove: () => void }[] = []
  if (catFilter !== "전체") filterChips.push({ key: "category", label: catFilter, onRemove: () => setCatFilter("전체") })
  if (modeFilter !== "전체") filterChips.push({ key: "mode", label: modeFilter, onRemove: () => setModeFilter("전체") })
  if (activeFilter !== "전체") filterChips.push({ key: "active", label: activeFilter, onRemove: () => setActiveFilter("전체") })

  const sorted = useMemo(() => {
    if (sort.length === 0) return filtered
    return [...filtered].sort((a, b) => {
      for (const spec of sort) {
        const va = sortValue(a, spec.key)
        const vb = sortValue(b, spec.key)
        const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
        if (d !== 0) return spec.dir === "asc" ? d : -d
      }
      return 0
    })
  }, [filtered, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const pageRows = sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  useEffect(() => {
    if (editingRowId && !pageRows.some((r) => r.id === editingRowId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingRowId(null)
    }
  }, [editingRowId, pageRows])

  function handleSort(key: SortKey, additive: boolean) {
    setSort((prev) => cycleSort(prev, key, additive))
    setPage(1)
  }

  function getColWidth(key: ColKey) {
    return colWidths[key] ?? DEFAULT_COL_WIDTHS[key]
  }

  function resizeColumn(key: ColKey, deltaPx: number) {
    setColWidths((prev) => {
      const current = prev[key] ?? DEFAULT_COL_WIDTHS[key]
      const next = Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, current + deltaPx))
      const updated = { ...prev, [key]: next }
      saveColWidths(updated)
      return updated
    })
  }

  function resetFilters() {
    setQuery("")
    setCatFilter("전체")
    setModeFilter("전체")
    setActiveFilter("전체")
    setSort([{ key: "id", dir: "asc" }])
    setPage(1)
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === sorted.length && sorted.length > 0 ? new Set() : new Set(sorted.map((r) => r.id))))
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddRow() {
    const id = draft.addRow()
    setPage(1)
    setHighlightId(id)
  }

  function handleBulkDelete() {
    selected.forEach((id) => draft.markDeleted(id))
    setSelected(new Set())
  }

  function handleBulkApply() {
    if (bulkCategory) selected.forEach((id) => draft.editCell(id, "category", bulkCategory))
    if (bulkMode) selected.forEach((id) => draft.editCell(id, "collect_mode", bulkMode))
    if (bulkActive) selected.forEach((id) => draft.editCell(id, "active", bulkActive === "사용"))
    setBulkCategory("")
    setBulkMode("")
    setBulkActive("")
  }

  function handleSaveClick() {
    if (!draft.validate()) {
      toast({ tone: "danger", title: "저장할 수 없습니다", description: "필수값 또는 중복 오류를 확인해주세요." })
      return
    }
    setConfirmOpen(true)
  }

  async function handleConfirmSave() {
    setSaving(true)
    const outcomes = await draft.commit()
    setSaving(false)
    setConfirmOpen(false)
    const failed = outcomes.filter((o) => !o.ok)
    if (failed.length === 0) {
      toast({ tone: "success", title: "변경사항이 저장되었습니다" })
    } else {
      toast({
        tone: "danger",
        title: `저장 실패 ${failed.length}건`,
        description: failed.map((f) => `${f.id}: ${f.error}`).join(" · "),
      })
    }
  }

  function jumpToRow(id: string) {
    setHighlightId(id)
    const idx = sorted.findIndex((r) => r.id === id)
    if (idx >= 0) setPage(Math.floor(idx / pageSize) + 1)
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ block: "center", behavior: "smooth" })
    })
  }

  const show = (key: ColKey) => visibleCols.includes(key)
  const colSpan = 2 + ALL_COLS.filter((c) => show(c.key)).length

  const toolbarAction = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {draft.hasChanges ? (
        <span className="text-xs font-medium text-warning">변경사항 {draft.summary.total}건 · 저장하지 않음</span>
      ) : (
        <span className="text-xs text-muted-foreground">변경사항은 저장 버튼을 눌러야 반영됩니다.</span>
      )}
      <MiniButton onClick={draft.revertAll} disabled={!draft.hasChanges}>
        <X className="h-3.5 w-3.5" />
        취소
      </MiniButton>
      <MiniButton accent="primary" onClick={handleSaveClick} disabled={!draft.hasChanges || saving}>
        <Save className="h-3.5 w-3.5" />
        저장{draft.hasChanges ? ` ${draft.summary.total}건` : ""}
      </MiniButton>
      <ExportExcelButton
        rows={sorted}
        filename="SW_마스터_관리"
        columns={[
          { label: "마스터 ID", value: (r: EffectiveRow) => r.id },
          { label: "제품명", value: (r: EffectiveRow) => r.values.name },
          { label: "벤더", value: (r: EffectiveRow) => r.values.vendor },
          { label: "분류", value: (r: EffectiveRow) => r.values.category },
          { label: "표준 버전", value: (r: EffectiveRow) => r.values.std_version },
          { label: "수집 모드", value: (r: EffectiveRow) => r.values.collect_mode },
          { label: "사용 여부", value: (r: EffectiveRow) => (r.values.active ? "사용" : "미사용") },
          { label: "최근 갱신일", value: (r: EffectiveRow) => r.updatedAt ?? "-" },
        ]}
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Database}
        title="SW 마스터 관리"
        description="표준 소프트웨어 마스터 데이터를 편집형 그리드에서 관리합니다. 변경사항은 저장 버튼을 눌러야 반영됩니다."
        action={toolbarAction}
      />

      {/* 검색 + 필터 */}
      <div className="glow-card animate-rise flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        {/* 기본 검색 한 줄 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="마스터 ID, 제품명, 벤더, 표준 버전 검색"
              className="w-full rounded-lg border border-border/60 bg-background/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value as (typeof CATEGORY_FILTERS)[number])
              setPage(1)
            }}
            className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-2 text-xs font-medium text-foreground focus:border-primary/60 focus:outline-none"
          >
            <option value="전체">분류 전체</option>
            {MASTER_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={modeFilter}
            onChange={(e) => {
              setModeFilter(e.target.value as (typeof COLLECT_MODE_FILTERS)[number])
              setPage(1)
            }}
            className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-2 text-xs font-medium text-foreground focus:border-primary/60 focus:outline-none"
          >
            <option value="전체">수집 모드 전체</option>
            {COLLECT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as (typeof ACTIVE_FILTERS)[number])
              setPage(1)
            }}
            className="rounded-lg border border-border/60 bg-background/50 px-2.5 py-2 text-xs font-medium text-foreground focus:border-primary/60 focus:outline-none"
          >
            <option value="전체">사용 여부 전체</option>
            <option value="사용">사용</option>
            <option value="미사용">미사용</option>
          </select>

          <MiniButton
            onClick={() => setDetailFiltersOpen((v) => !v)}
            className={cn(detailFiltersOpen && "border-primary/50 bg-primary/10 text-primary")}
          >
            <Filter className="h-3.5 w-3.5" />
            상세 필터{detailFilterCount > 0 ? ` (${detailFilterCount})` : ""}
            {detailFiltersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </MiniButton>

          <MiniButton onClick={resetFilters}>
            <RotateCcw className="h-3 w-3" />
            초기화
          </MiniButton>
        </div>

        {/* 상세 필터 아코디언 */}
        {detailFiltersOpen ? (
          <div className="animate-rise flex flex-col gap-3 border-t border-border/50 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">분류</span>
              {CATEGORY_FILTERS.map((c) => {
                const Icon = c === "전체" ? null : CATEGORY_ICONS[c]
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCatFilter(c)
                      setPage(1)
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      catFilter === c
                        ? "border-primary/60 bg-primary/8 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                    {c}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">수집 모드</span>
              {COLLECT_MODE_FILTERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModeFilter(m)
                    setPage(1)
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    modeFilter === m
                      ? "border-primary/60 bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">사용 여부</span>
              {ACTIVE_FILTERS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setActiveFilter(a)
                    setPage(1)
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    activeFilter === a
                      ? "border-primary/60 bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>

            {filterChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
                <span className="text-[11px] text-muted-foreground">적용된 조건</span>
                {filterChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                  >
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={`${chip.label} 필터 해제`}
                      className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 선택/일괄 작업 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-accent/8 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 ? (
            <span className="text-xs font-semibold text-primary">{selected.size}개 선택됨</span>
          ) : (
            <span className="text-xs text-muted-foreground">총 {sorted.length}건</span>
          )}
          {selected.size > 0 ? (
            <>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as typeof bulkCategory)}
                className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="">분류 변경 안 함</option>
                {MASTER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value as typeof bulkMode)}
                className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="">수집 모드 변경 안 함</option>
                {COLLECT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={bulkActive}
                onChange={(e) => setBulkActive(e.target.value as typeof bulkActive)}
                className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="">사용 여부 변경 안 함</option>
                <option value="사용">사용</option>
                <option value="미사용">미사용</option>
              </select>
              <MiniButton
                accent="primary"
                onClick={handleBulkApply}
                disabled={!bulkCategory && !bulkMode && !bulkActive}
              >
                적용
              </MiniButton>
            </>
          ) : null}
          <MiniButton accent="destructive" onClick={handleBulkDelete} disabled={selected.size === 0}>
            삭제
          </MiniButton>
        </div>
        <div className="flex items-center gap-2">
          <MiniButton accent="primary" onClick={handleAddRow}>
            <Plus className="h-3.5 w-3.5" />
            추가
          </MiniButton>
          <div ref={colMenuRef} className="relative">
            <MiniButton onClick={() => setColMenuOpen((v) => !v)} className="border-border bg-card text-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              컬럼 설정
            </MiniButton>
            {colMenuOpen ? (
              <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-border/70 bg-card shadow-2xl">
                <ul className="py-1.5">
                  {ALL_COLS.map(({ key, label }) => {
                    const checked = show(key)
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => {
                            const next = checked ? visibleCols.filter((k) => k !== key) : [...visibleCols, key]
                            setVisibleCols(next)
                            saveVisibleCols(next)
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-accent/60"
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-border/60",
                            )}
                          >
                            {checked && <Check className="h-2.5 w-2.5" />}
                          </span>
                          <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="border-t border-border/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleCols(FACTORY_VISIBLE)
                      saveVisibleCols(FACTORY_VISIBLE)
                    }}
                    className="w-full text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    기본값으로 복원
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <TableShell>
        <thead>
          <tr>
            <Th className="w-12 bg-accent/15">
              <input
                type="checkbox"
                checked={sorted.length > 0 && selected.size === sorted.length}
                onChange={toggleSelectAll}
                aria-label="전체 선택"
                className="h-4 w-4 rounded border-border/60 accent-primary"
              />
            </Th>
            <Th className="w-12 bg-accent/15">{null}</Th>
            {show("id") && (
              <SortTh col="id" label="마스터 ID" sort={sort} onSort={handleSort} width={getColWidth("id")} onResize={(d) => resizeColumn("id", d)} />
            )}
            {show("category") && (
              <SortTh col="category" label="분류" sort={sort} onSort={handleSort} width={getColWidth("category")} onResize={(d) => resizeColumn("category", d)} />
            )}
            {show("name") && (
              <SortTh col="name" label="제품명" sort={sort} onSort={handleSort} width={getColWidth("name")} onResize={(d) => resizeColumn("name", d)} />
            )}
            {show("std_version") && (
              <SortTh col="std_version" label="버전" sort={sort} onSort={handleSort} width={getColWidth("std_version")} onResize={(d) => resizeColumn("std_version", d)} />
            )}
            {show("vendor") && (
              <SortTh col="vendor" label="제조사" sort={sort} onSort={handleSort} width={getColWidth("vendor")} onResize={(d) => resizeColumn("vendor", d)} />
            )}
            {show("collect_mode") && (
              <SortTh col="collect_mode" label="수집 모드" sort={sort} onSort={handleSort} width={getColWidth("collect_mode")} onResize={(d) => resizeColumn("collect_mode", d)} />
            )}
            {show("active") && (
              <SortTh col="active" label="사용 여부" sort={sort} onSort={handleSort} width={getColWidth("active")} onResize={(d) => resizeColumn("active", d)} />
            )}
            {show("created_at") && (
              <SortTh col="created_at" label="등록일" sort={sort} onSort={handleSort} width={getColWidth("created_at")} onResize={(d) => resizeColumn("created_at", d)} />
            )}
            {show("manager") && (
              <Th className="relative bg-accent/15" style={{ width: getColWidth("manager"), minWidth: getColWidth("manager"), maxWidth: getColWidth("manager") }}>
                관리자
                <ColumnResizeHandle onResize={(d) => resizeColumn("manager", d)} />
              </Th>
            )}
            {show("updated_by") && (
              <Th className="relative bg-accent/15" style={{ width: getColWidth("updated_by"), minWidth: getColWidth("updated_by"), maxWidth: getColWidth("updated_by") }}>
                수정자
                <ColumnResizeHandle onResize={(d) => resizeColumn("updated_by", d)} />
              </Th>
            )}
            {show("note") && (
              <Th className="relative bg-accent/15" style={{ width: getColWidth("note"), minWidth: getColWidth("note"), maxWidth: getColWidth("note") }}>
                비고
                <ColumnResizeHandle onResize={(d) => resizeColumn("note", d)} />
              </Th>
            )}
          </tr>
        </thead>
        <tbody>
          {draft.loading ? (
            <tr>
              <td colSpan={colSpan} className="border-b border-border/40 px-3 py-8 text-center text-muted-foreground">
                불러오는 중…
              </td>
            </tr>
          ) : pageRows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="border-b border-border/40 px-3 py-8 text-center text-muted-foreground">
                검색 결과가 없습니다.
              </td>
            </tr>
          ) : (
            pageRows.map((row) => {
              const requiredEmpty = (f: "name" | "vendor" | "std_version") =>
                row.status !== "clean" && row.status !== "deleted" && !row.values[f].trim()
              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.id, el)
                    else rowRefs.current.delete(row.id)
                  }}
                  onDoubleClick={() => setEditingRowId((prev) => (prev === row.id ? null : row.id))}
                  className={cn(
                    "border-l-2 border-l-transparent transition-colors hover:border-l-primary",
                    row.status === "deleted"
                      ? "bg-destructive/8 line-through opacity-70 hover:bg-destructive/12"
                      : row.status === "added"
                        ? "bg-success/8 hover:bg-success/12"
                        : row.status === "modified"
                          ? "bg-warning/8 hover:bg-warning/12"
                          : selected.has(row.id)
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-accent/30",
                    highlightId === row.id && "ring-2 ring-inset ring-primary/60",
                  )}
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      aria-label={`${row.values.name || row.id} 선택`}
                      className="h-4 w-4 rounded border-border/60 accent-primary"
                    />
                  </Td>
                  <Td>
                    <RowMenu
                      row={row}
                      editing={editingRowId === row.id}
                      onToggleEdit={() => setEditingRowId((prev) => (prev === row.id ? null : row.id))}
                      onDetail={() => setDetailRow(row)}
                      onDuplicate={() => draft.duplicateRow(row.id)}
                      onToggleDelete={() => (row.status === "deleted" ? draft.undoDelete(row.id) : draft.markDeleted(row.id))}
                      onRevert={() => draft.revertRow(row.id)}
                    />
                  </Td>
                  {show("id") && (
                    <Td
                      className="font-mono text-xs text-muted-foreground"
                      style={{ width: getColWidth("id"), minWidth: getColWidth("id"), maxWidth: getColWidth("id") }}
                    >
                      <div className="flex items-center gap-1.5">
                        {row.id}
                        <RowStatusBadge status={row.status} />
                      </div>
                    </Td>
                  )}
                  {show("category") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("category"), minWidth: getColWidth("category"), maxWidth: getColWidth("category") }}
                    >
                      <div className="flex items-center justify-center">
                        {editingRowId === row.id && row.status !== "deleted" ? (
                          <EditableCategory
                            value={row.values.category}
                            onChange={(v) => draft.editCell(row.id, "category", v)}
                            dirty={row.dirtyFields.has("category")}
                          />
                        ) : (
                          <CategoryCell value={row.values.category} />
                        )}
                      </div>
                    </Td>
                  )}
                  {show("name") && (
                    <Td style={{ width: getColWidth("name"), minWidth: getColWidth("name"), maxWidth: getColWidth("name") }}>
                      <EditableText
                        value={row.values.name}
                        onChange={(v) => draft.editCell(row.id, "name", v)}
                        dirty={row.dirtyFields.has("name")}
                        error={row.fieldErrors?.name}
                        required={requiredEmpty("name")}
                        bold
                      />
                    </Td>
                  )}
                  {show("std_version") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("std_version"), minWidth: getColWidth("std_version"), maxWidth: getColWidth("std_version") }}
                    >
                      <EditableText
                        value={row.values.std_version}
                        onChange={(v) => draft.editCell(row.id, "std_version", v)}
                        dirty={row.dirtyFields.has("std_version")}
                        error={row.fieldErrors?.std_version}
                        required={requiredEmpty("std_version")}
                      />
                    </Td>
                  )}
                  {show("vendor") && (
                    <Td style={{ width: getColWidth("vendor"), minWidth: getColWidth("vendor"), maxWidth: getColWidth("vendor") }}>
                      <EditableVendor
                        rowId={row.id}
                        value={row.values.vendor}
                        onChange={(v) => draft.editCell(row.id, "vendor", v)}
                        options={vendorOptions}
                        dirty={row.dirtyFields.has("vendor")}
                        error={row.fieldErrors?.vendor}
                        required={requiredEmpty("vendor")}
                      />
                    </Td>
                  )}
                  {show("collect_mode") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("collect_mode"), minWidth: getColWidth("collect_mode"), maxWidth: getColWidth("collect_mode") }}
                    >
                      <div className="flex items-center justify-center">
                        {editingRowId === row.id && row.status !== "deleted" ? (
                          <EditableCollectMode
                            value={row.values.collect_mode}
                            onChange={(v) => draft.editCell(row.id, "collect_mode", v)}
                            dirty={row.dirtyFields.has("collect_mode")}
                          />
                        ) : (
                          <CollectModeBadge value={row.values.collect_mode} />
                        )}
                      </div>
                    </Td>
                  )}
                  {show("active") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("active"), minWidth: getColWidth("active"), maxWidth: getColWidth("active") }}
                    >
                      <div className="flex items-center justify-center">
                        {editingRowId === row.id && row.status !== "deleted" ? (
                          <ActiveToggle
                            value={row.values.active}
                            onChange={(v) => draft.editCell(row.id, "active", v)}
                            dirty={row.dirtyFields.has("active")}
                          />
                        ) : (
                          <UseStatusBadge value={row.values.active} />
                        )}
                      </div>
                    </Td>
                  )}
                  {show("created_at") && (
                    <Td
                      className="text-center text-xs text-muted-foreground"
                      style={{ width: getColWidth("created_at"), minWidth: getColWidth("created_at"), maxWidth: getColWidth("created_at") }}
                    >
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString("ko-KR") : "-"}
                    </Td>
                  )}
                  {show("manager") && (
                    <Td style={{ width: getColWidth("manager"), minWidth: getColWidth("manager"), maxWidth: getColWidth("manager") }}>
                      <EditableText
                        value={row.values.manager}
                        onChange={(v) => draft.editCell(row.id, "manager", v)}
                        dirty={row.dirtyFields.has("manager")}
                      />
                    </Td>
                  )}
                  {show("updated_by") && (
                    <Td
                      className="text-xs text-muted-foreground"
                      style={{ width: getColWidth("updated_by"), minWidth: getColWidth("updated_by"), maxWidth: getColWidth("updated_by") }}
                    >
                      {row.updatedBy ?? "-"}
                    </Td>
                  )}
                  {show("note") && (
                    <Td style={{ width: getColWidth("note"), minWidth: getColWidth("note"), maxWidth: getColWidth("note") }}>
                      <EditableText
                        value={row.values.note}
                        onChange={(v) => draft.editCell(row.id, "note", v)}
                        dirty={row.dirtyFields.has("note")}
                      />
                    </Td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </TableShell>

      {/* 페이지네이션 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          표시 개수
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])
              setPage(1)
            }}
            className="rounded-md border border-border/60 bg-background/50 px-2 py-1 text-xs"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}개</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
            className="rounded-md border border-border/60 px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-muted-foreground">{pageSafe} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
            className="rounded-md border border-border/60 px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>

      {/* 변경 이력 */}
      {draft.hasChanges ? (
        <div className="glow-card animate-rise flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <History className="h-4 w-4 text-primary" />
              변경 이력 {draft.changeLog.length}건
            </span>
            <div className="flex items-center gap-2">
              <MiniButton onClick={draft.revertAll}>
                <X className="h-3 w-3" />
                변경사항 초기화
              </MiniButton>
              <MiniButton accent="primary" onClick={handleSaveClick} disabled={saving}>
                <Save className="h-3 w-3" />
                저장 {draft.summary.total}건
              </MiniButton>
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {draft.changeLog.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => jumpToRow(entry.id)}
                  className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  {entry.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MasterDetailModal row={detailRow} onClose={() => setDetailRow(null)} />

      {/* 저장 확인 팝업 */}
      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => !saving && setConfirmOpen(false)}
            className="animate-overlay absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="glass relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-primary/25 p-5 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="text-base font-bold text-foreground">변경사항을 저장하시겠습니까?</h2>
            </div>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {draft.summary.added > 0 ? <li>추가 {draft.summary.added}건</li> : null}
              {draft.summary.modified > 0 ? <li>수정 {draft.summary.modified}건</li> : null}
              {draft.summary.deleted > 0 ? <li>삭제 {draft.summary.deleted}건</li> : null}
            </ul>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
