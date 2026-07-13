"use client"

import { useEffect, useState } from "react"
import {
  Server,
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
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
  type RiskLevel,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type ServerRow = Tables<"servers">
type ServerCategory = ServerRow["category"]
type ServerStatus = ServerRow["status"]

const SERVER_CATEGORIES: ServerCategory[] = ["WEB", "WAS", "DB"]
const SERVER_STATUSES: ServerStatus[] = ["Running", "Maintenance", "Stopped"]

const statusRisk: Record<ServerStatus, RiskLevel> = {
  Running: 1,
  Maintenance: 3,
  Stopped: 4,
}
const statusLabel: Record<ServerStatus, string> = {
  Running: "정상 가동",
  Maintenance: "점검 중",
  Stopped: "중지",
}

/* ---- Shared input style for inline add/edit form ---- */
const inputCls =
  "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

type ServerFormValues = Omit<ServerRow, "id" | "created_at">

const EMPTY_SERVER_FORM: ServerFormValues = {
  name: "",
  hostname: "",
  ip: "",
  category: "WAS",
  os_type: "",
  location: "",
  status: "Running",
}

/* ---- Inline add/edit form ---- */
function ServerFormPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: ServerFormValues
  onCancel: () => void
  onSubmit: (values: ServerFormValues) => void
}) {
  const [values, setValues] = useState<ServerFormValues>(initial ?? EMPTY_SERVER_FORM)

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">서버명</span>
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="예: WAS-PRD-03"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">호스트명</span>
        <input
          value={values.hostname}
          onChange={(e) => setValues((v) => ({ ...v, hostname: e.target.value }))}
          placeholder="예: was-prd-03.corp.local"
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">IP</span>
        <input
          value={values.ip}
          onChange={(e) => setValues((v) => ({ ...v, ip: e.target.value }))}
          placeholder="예: 10.0.1.23"
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">분류</span>
        <select
          value={values.category}
          onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as ServerCategory }))}
          className={inputCls}
        >
          {SERVER_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">OS</span>
        <input
          value={values.os_type}
          onChange={(e) => setValues((v) => ({ ...v, os_type: e.target.value }))}
          placeholder="예: Rocky Linux 9"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">위치</span>
        <input
          value={values.location}
          onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
          placeholder="예: 판교 IDC 3F"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        <select
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ServerStatus }))}
          className={inputCls}
        >
          {SERVER_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={() => values.name.trim() && values.hostname.trim() && values.ip.trim() && onSubmit(values)}
          disabled={!values.name.trim() || !values.hostname.trim() || !values.ip.trim()}
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
type ServerColKey = "name" | "hostname" | "ip" | "category" | "os_type" | "location" | "status"
const SERVER_ALL_COLS: { key: ServerColKey; label: string }[] = [
  { key: "name", label: "서버명" },
  { key: "hostname", label: "호스트명" },
  { key: "ip", label: "IP" },
  { key: "category", label: "분류" },
  { key: "os_type", label: "OS" },
  { key: "location", label: "위치" },
  { key: "status", label: "상태" },
]
const SERVER_FACTORY_VISIBLE: ServerColKey[] = SERVER_ALL_COLS.map((c) => c.key)
const SERVER_LS_KEY = "admin_server_columns"

type ServerSortKey = ServerColKey | "none"
const serverStatusOrder: Record<ServerStatus, number> = { Stopped: 0, Maintenance: 1, Running: 2 }

function serverSortValue(s: ServerRow, key: ServerSortKey): string | number {
  if (key === "status") return serverStatusOrder[s.status]
  if (key === "none") return 0
  return s[key]
}

export function ServersView() {
  const { toast } = useToast()

  const [servers, setServers] = useState<ServerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<ServerSortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [visible, setVisible] = useState<ServerColKey[]>(() => loadColumnVisibility(SERVER_LS_KEY, SERVER_FACTORY_VISIBLE))

  const [panel, setPanel] = useState<"add" | string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function loadServers() {
    const supabase = createClient()
    supabase
      .from("servers")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setServers(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadServers()
  }, [])

  function handleSort(col: ServerSortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
  }

  const filtered = servers
    .filter((s) => {
      const q = query.trim().toLowerCase()
      return !q || [s.name, s.hostname, s.ip, s.location].some((f) => f.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const va = serverSortValue(a, sortKey)
      const vb = serverSortValue(b, sortKey)
      const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
      return sortDir === "asc" ? d : -d
    })

  const show = (key: ServerColKey) => visible.includes(key)
  const pagination = usePagination(filtered)

  async function saveServer(values: ServerFormValues) {
    const supabase = createClient()
    if (panel === "add") {
      const payload: TablesInsert<"servers"> = { ...values }
      const { error } = await supabase.from("servers").insert(payload)
      if (error) {
        toast({ title: "서버 등록 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "서버가 등록되었습니다", tone: "success" })
    } else if (panel) {
      const { error } = await supabase.from("servers").update(values).eq("id", panel)
      if (error) {
        toast({ title: "서버 수정 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "서버 정보가 수정되었습니다", tone: "success" })
    }
    setPanel(null)
    loadServers()
  }

  async function deleteServer(target: ServerRow) {
    if (!window.confirm(`"${target.name}" 서버를 삭제하시겠습니까?`)) return
    const supabase = createClient()
    const { error } = await supabase.from("servers").delete().eq("id", target.id)
    if (error) {
      toast({ title: "삭제 실패", description: error.message, tone: "danger" })
      return
    }
    toast({ title: "서버가 삭제되었습니다", tone: "info" })
    loadServers()
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map((s) => s.id)),
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
  function cancelSelection() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }
  async function saveSelection() {
    if (selectedIds.size === 0) {
      cancelSelection()
      return
    }
    if (!window.confirm(`선택한 서버 ${selectedIds.size}건을 삭제하시겠습니까?`)) return
    const supabase = createClient()
    const { error } = await supabase.from("servers").delete().in("id", Array.from(selectedIds))
    if (error) {
      toast({ title: "삭제 실패", description: error.message, tone: "danger" })
      return
    }
    toast({ title: `서버 ${selectedIds.size}건이 삭제되었습니다`, tone: "info" })
    cancelSelection()
    loadServers()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Server}
        title="서버 관리"
        description="자산 목록·신규 자산 요청 등에서 설치 서버로 선택할 수 있는 서버 목록을 관리합니다."
      />

      <SectionCard
        title="서버 목록"
        subtitle="등록된 서버"
        icon={Server}
        action={
          panel ? null : selectMode ? (
            <div className="flex items-center gap-1.5">
              <MiniButton accent="success" onClick={saveSelection}>
                <Check className="h-3.5 w-3.5" />
                저장
              </MiniButton>
              <MiniButton onClick={cancelSelection}>
                <X className="h-3.5 w-3.5" />
                취소
              </MiniButton>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                  placeholder="서버명, 호스트명, IP, 위치 검색"
                  className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <ExportExcelButton
                rows={filtered}
                filename="서버_관리"
                columns={[
                  { label: "서버명", value: (s: ServerRow) => s.name },
                  { label: "호스트명", value: (s: ServerRow) => s.hostname },
                  { label: "IP", value: (s: ServerRow) => s.ip },
                  { label: "분류", value: (s: ServerRow) => s.category },
                  { label: "OS", value: (s: ServerRow) => s.os_type },
                  { label: "위치", value: (s: ServerRow) => s.location },
                  { label: "상태", value: (s: ServerRow) => statusLabel[s.status] },
                ]}
              />
              <ColumnVisibilityMenu
                allCols={SERVER_ALL_COLS}
                visible={visible}
                onChange={setVisible}
                factoryDefault={SERVER_FACTORY_VISIBLE}
                storageKey={SERVER_LS_KEY}
              />
              <MiniButton accent="primary" onClick={() => setPanel("add")}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </MiniButton>
              <MiniButton accent="destructive" onClick={() => setSelectMode(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </MiniButton>
            </div>
          )
        }
      >
        {panel === "add" ? (
          <ServerFormPanel onCancel={() => setPanel(null)} onSubmit={saveServer} />
        ) : null}

        <TableShell scrollHint>
          <thead>
            <tr>
              {selectMode ? (
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
              {show("name") && <SortTh col="name" label="서버명" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("hostname") && <SortTh col="hostname" label="호스트명" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("ip") && <SortTh col="ip" label="IP" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("category") && <SortTh col="category" label="분류" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="center" />}
              {show("os_type") && <SortTh col="os_type" label="OS" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("location") && <SortTh col="location" label="위치" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("status") && <SortTh col="status" label="상태" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="center" />}
              {selectMode ? null : <Th className={TABLE_HEADER_CELL_H}>관리</Th>}
            </tr>
          </thead>
          <tbody>
            {!loading && servers.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">등록된 서버가 없습니다.</span>
                </Td>
              </tr>
            ) : (
              pagination.pageItems.map((s) =>
                panel === s.id ? (
                  <tr key={s.id}>
                    <td colSpan={8} className="border-b border-border/40 p-0">
                      <ServerFormPanel
                        initial={{
                          name: s.name,
                          hostname: s.hostname,
                          ip: s.ip,
                          category: s.category,
                          os_type: s.os_type,
                          location: s.location,
                          status: s.status,
                        }}
                        onCancel={() => setPanel(null)}
                        onSubmit={saveServer}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="transition-colors hover:bg-accent/40">
                    {selectMode ? (
                      <Td className={TABLE_ROW_CELL_H}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelected(s.id)}
                          aria-label={`${s.name} 선택`}
                          className="h-4 w-4 rounded border-border/60 accent-primary"
                        />
                      </Td>
                    ) : null}
                    {show("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{s.name}</Td>}
                    {show("hostname") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{s.hostname}</Td>}
                    {show("ip") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{s.ip}</Td>}
                    {show("category") && <Td className={TABLE_ROW_CELL_H}><StatusBadge accent="primary">{s.category}</StatusBadge></Td>}
                    {show("os_type") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{s.os_type}</Td>}
                    {show("location") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{s.location}</Td>}
                    {show("status") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge risk={statusRisk[s.status]} pulse={s.status === "Stopped"}>
                          {statusLabel[s.status]}
                        </StatusBadge>
                      </Td>
                    )}
                    {selectMode ? null : (
                      <Td className={TABLE_ROW_CELL_H}>
                        <div className="flex items-center gap-1.5">
                          <MiniButton onClick={() => setPanel(s.id)}>
                            <Pencil className="h-3 w-3" />
                            수정
                          </MiniButton>
                          <MiniButton accent="destructive" onClick={() => deleteServer(s)}>
                            <Trash2 className="h-3 w-3" />
                            삭제
                          </MiniButton>
                        </div>
                      </Td>
                    )}
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
    </div>
  )
}
