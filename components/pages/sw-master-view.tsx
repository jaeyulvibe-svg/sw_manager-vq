"use client"

import { useEffect, useState } from "react"
import {
  Database,
  Search,
  Plus,
  Pencil,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
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
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/types"
import {
  MASTER_CATEGORIES,
  MASTER_ACTOR,
  formatDateOnly,
  type MasterRow,
} from "@/components/pages/sw-master/master-shared"
import { CategoryCell, UseStatusBadge } from "@/components/pages/sw-master/cells"
import { cn } from "@/lib/utils"

/* ---- Shared input style for inline add/edit form ---- */
const inputCls =
  "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

type MasterFormValues = {
  name: string
  vendor: string
  category: MasterRow["category"]
  std_version: string
  active: boolean
  manager: string
  note: string
}

const EMPTY_MASTER_FORM: MasterFormValues = {
  name: "",
  vendor: "",
  category: MASTER_CATEGORIES[0],
  std_version: "",
  active: true,
  manager: "",
  note: "",
}

function toFormValues(row: MasterRow): MasterFormValues {
  return {
    name: row.name,
    vendor: row.vendor,
    category: row.category,
    std_version: row.std_version,
    active: row.active,
    manager: row.manager ?? "",
    note: row.note ?? "",
  }
}

/* ---- Inline add/edit form ---- */
function MasterFormPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: MasterFormValues
  onCancel: () => void
  onSubmit: (values: MasterFormValues) => void
}) {
  const [values, setValues] = useState<MasterFormValues>(initial ?? EMPTY_MASTER_FORM)

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">제품명</span>
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="예: Apache Tomcat"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">벤더</span>
        <input
          value={values.vendor}
          onChange={(e) => setValues((v) => ({ ...v, vendor: e.target.value }))}
          placeholder="예: Apache"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">분류</span>
        <select
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as MasterRow["category"] }))}
          className={inputCls}
        >
          {MASTER_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">표준 버전</span>
        <input
          value={values.std_version}
          onChange={(e) => setValues((v) => ({ ...v, std_version: e.target.value }))}
          placeholder="예: 10.1.24"
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">사용 여부</span>
        <select
          value={values.active ? "사용" : "미사용"}
          onChange={(e) => setValues((v) => ({ ...v, active: e.target.value === "사용" }))}
          className={inputCls}
        >
          <option>사용</option>
          <option>미사용</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">관리자</span>
        <input
          value={values.manager}
          onChange={(e) => setValues((v) => ({ ...v, manager: e.target.value }))}
          placeholder="예: 홍길동"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-2">
        <span className="font-medium text-muted-foreground">비고</span>
        <input
          value={values.note}
          onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
          placeholder="선택 입력"
          className={inputCls}
        />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={() =>
            values.name.trim() && values.vendor.trim() && values.std_version.trim() && onSubmit(values)
          }
          disabled={!values.name.trim() || !values.vendor.trim() || !values.std_version.trim()}
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

/* ---- 컬럼 정의 + 정렬 ---- */
type ColKey =
  | "id" | "category" | "name" | "std_version" | "vendor" | "active" | "created_at"
  | "manager" | "updated_by" | "note"

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "id", label: "마스터 ID" },
  { key: "category", label: "분류" },
  { key: "name", label: "제품명" },
  { key: "std_version", label: "버전" },
  { key: "vendor", label: "제조사" },
  { key: "active", label: "사용 여부" },
  { key: "created_at", label: "등록일" },
  { key: "manager", label: "관리자" },
  { key: "updated_by", label: "수정자" },
  { key: "note", label: "비고" },
]
const FACTORY_VISIBLE: ColKey[] = [
  "id", "category", "name", "std_version", "vendor", "active", "created_at",
]
const LS_KEY = "sw_master_columns"

type SortKey = ColKey | "none"

function sortValue(row: MasterRow, key: SortKey): string | number {
  if (key === "active") return row.active ? 1 : 0
  if (key === "created_at") return row.created_at ? new Date(row.created_at).getTime() : 0
  if (key === "updated_by") return row.updated_by ?? ""
  if (key === "manager") return row.manager ?? ""
  if (key === "note") return row.note ?? ""
  if (key === "none") return 0
  return row[key]
}

export function SwMasterView() {
  const { toast } = useToast()

  const [masters, setMasters] = useState<MasterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [visible, setVisible] = useState<ColKey[]>(() => loadColumnVisibility(LS_KEY, FACTORY_VISIBLE))

  const [panel, setPanel] = useState<"add" | string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteRequest, setDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)

  function loadMasters() {
    const supabase = createClient()
    supabase
      .from("sw_masters")
      .select("*")
      .is("deleted_at", null)
      .order("id")
      .then(({ data }) => {
        if (data) setMasters(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadMasters()
  }, [])

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
  }

  const filtered = masters
    .filter((m) => {
      const q = query.trim().toLowerCase()
      return !q || [m.id, m.name, m.vendor, m.std_version].some((f) => f.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const va = sortValue(a, sortKey)
      const vb = sortValue(b, sortKey)
      const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
      return sortDir === "asc" ? d : -d
    })

  const show = (key: ColKey) => visible.includes(key)
  const pagination = usePagination(filtered)

  async function saveMaster(values: MasterFormValues) {
    const supabase = createClient()

    if (panel === "add") {
      const payload: TablesInsert<"sw_masters"> = {
        name: values.name.trim(),
        vendor: values.vendor.trim(),
        category: values.category,
        std_version: values.std_version.trim(),
        active: values.active,
        manager: values.manager.trim() || null,
        note: values.note.trim() || null,
        updated_by: MASTER_ACTOR,
        deactivated_at: values.active ? null : new Date().toISOString(),
      }
      const { error } = await supabase.from("sw_masters").insert(payload)
      if (error) {
        toast({ title: "SW 마스터 추가 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "SW 마스터가 추가되었습니다", tone: "success" })
    } else if (panel) {
      const previous = masters.find((m) => m.id === panel)
      const deactivatedAt = values.active
        ? null
        : previous && !previous.active
          ? previous.deactivated_at
          : new Date().toISOString()
      const payload: TablesUpdate<"sw_masters"> = {
        name: values.name.trim(),
        vendor: values.vendor.trim(),
        category: values.category,
        std_version: values.std_version.trim(),
        active: values.active,
        manager: values.manager.trim() || null,
        note: values.note.trim() || null,
        updated_by: MASTER_ACTOR,
        deactivated_at: deactivatedAt,
      }
      const { error } = await supabase.from("sw_masters").update(payload).eq("id", panel)
      if (error) {
        toast({ title: "SW 마스터 수정 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "SW 마스터가 수정되었습니다", tone: "success" })
    }
    setPanel(null)
    loadMasters()
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map((m) => m.id)),
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

  function requestDeleteSelected() {
    if (selectedIds.size === 0) return
    setDeleteRequest({
      ids: Array.from(selectedIds),
      title: `선택한 SW 마스터 ${selectedIds.size}건을 삭제할까요?`,
      confirmLabel: `${selectedIds.size}건 삭제`,
    })
  }
  async function confirmDelete() {
    if (!deleteRequest) return
    const supabase = createClient()
    const payload: TablesUpdate<"sw_masters"> = {
      active: false,
      deleted_at: new Date().toISOString(),
      deleted_by: MASTER_ACTOR,
    }
    const { error } = await supabase.from("sw_masters").update(payload).in("id", deleteRequest.ids)
    if (error) {
      toast({ title: "삭제 실패", description: error.message, tone: "danger" })
      setDeleteRequest(null)
      return
    }
    toast({ title: `SW 마스터 ${deleteRequest.ids.length}건이 삭제되었습니다`, tone: "info" })
    clearSelection()
    setDeleteRequest(null)
    loadMasters()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Database}
        title="SW 마스터"
        description="신규 자산 요청·자동수집 대상의 기준이 되는 표준 소프트웨어 목록을 관리합니다."
      />

      <SectionCard
        title="SW 마스터 목록"
        subtitle="등록된 표준 소프트웨어"
        icon={Database}
        action={
          panel ? null : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                  placeholder="마스터 ID, 제품명, 벤더, 버전 검색"
                  className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <ExportExcelButton
                rows={filtered}
                filename="SW_마스터_관리"
                columns={[
                  { label: "마스터 ID", value: (m: MasterRow) => m.id },
                  { label: "분류", value: (m: MasterRow) => m.category },
                  { label: "제품명", value: (m: MasterRow) => m.name },
                  { label: "버전", value: (m: MasterRow) => m.std_version },
                  { label: "제조사", value: (m: MasterRow) => m.vendor },
                  { label: "사용 여부", value: (m: MasterRow) => (m.active ? "사용" : "미사용") },
                  { label: "등록일", value: (m: MasterRow) => (m.created_at ? formatDateOnly(m.created_at) : "-") },
                  { label: "관리자", value: (m: MasterRow) => m.manager ?? "-" },
                  { label: "수정자", value: (m: MasterRow) => m.updated_by ?? "-" },
                  { label: "비고", value: (m: MasterRow) => m.note ?? "-" },
                ]}
              />
              <ColumnVisibilityMenu
                allCols={ALL_COLS}
                visible={visible}
                onChange={setVisible}
                factoryDefault={FACTORY_VISIBLE}
                storageKey={LS_KEY}
              />
              <MiniButton accent="primary" onClick={() => setPanel("add")}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </MiniButton>
            </div>
          )
        }
      >
        {panel === "add" ? (
          <MasterFormPanel onCancel={() => setPanel(null)} onSubmit={saveMaster} />
        ) : null}

        <SelectionActionBar count={selectedIds.size} onClear={clearSelection} onDelete={requestDeleteSelected} />

        <TableShell scrollHint>
          <thead>
            <tr>
              <Th className={cn("w-8", TABLE_HEADER_CELL_H)}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  aria-label="전체 선택"
                  className="h-4 w-4 rounded border-border/60 accent-primary"
                />
              </Th>
              {show("id") && <SortTh col="id" label="마스터 ID" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("category") && <SortTh col="category" label="분류" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="center" />}
              {show("name") && <SortTh col="name" label="제품명" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("std_version") && <SortTh col="std_version" label="버전" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("vendor") && <SortTh col="vendor" label="제조사" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("active") && <SortTh col="active" label="사용 여부" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="center" />}
              {show("created_at") && <SortTh col="created_at" label="등록일" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("manager") && <SortTh col="manager" label="관리자" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("updated_by") && <SortTh col="updated_by" label="수정자" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("note") && <SortTh col="note" label="비고" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              <Th className={TABLE_HEADER_CELL_H}>관리</Th>
            </tr>
          </thead>
          <tbody>
            {!loading && masters.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">등록된 SW 마스터가 없습니다.</span>
                </Td>
              </tr>
            ) : (
              pagination.pageItems.map((m) =>
                panel === m.id ? (
                  <tr key={m.id}>
                    <td colSpan={11} className="border-b border-border/40 p-0">
                      <MasterFormPanel
                        initial={toFormValues(m)}
                        onCancel={() => setPanel(null)}
                        onSubmit={saveMaster}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="transition-colors hover:bg-accent/40">
                    <Td className={TABLE_ROW_CELL_H}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={() => toggleSelected(m.id)}
                        aria-label={`${m.name} 선택`}
                        className="h-4 w-4 rounded border-border/60 accent-primary"
                      />
                    </Td>
                    {show("id") && <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{m.id}</Td>}
                    {show("category") && <Td className={TABLE_ROW_CELL_H}><CategoryCell value={m.category} /></Td>}
                    {show("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{m.name}</Td>}
                    {show("std_version") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{m.std_version}</Td>}
                    {show("vendor") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{m.vendor}</Td>}
                    {show("active") && <Td className={TABLE_ROW_CELL_H}><UseStatusBadge value={m.active} /></Td>}
                    {show("created_at") && (
                      <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>
                        {m.created_at ? formatDateOnly(m.created_at) : "-"}
                      </Td>
                    )}
                    {show("manager") && <Td className={cn("text-xs", TABLE_ROW_CELL_H)}>{m.manager ?? "-"}</Td>}
                    {show("updated_by") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{m.updated_by ?? "-"}</Td>}
                    {show("note") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{m.note ?? "-"}</Td>}
                    <Td className={TABLE_ROW_CELL_H}>
                      <MiniButton onClick={() => setPanel(m.id)}>
                        <Pencil className="h-3 w-3" />
                        수정
                      </MiniButton>
                    </Td>
                  </tr>
                ),
              )
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
