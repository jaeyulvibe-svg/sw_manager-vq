"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Boxes, Search, Eye, Pencil,
  Filter, ChevronUp, ChevronDown, RotateCcw, X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import {
  PageHeader, StatusBadge, TableShell, Th, Td, MiniButton, ExportExcelButton,
  SortTh, ColumnVisibilityMenu, loadColumnVisibility, TABLE_HEADER_CELL_H, TABLE_ROW_CELL_H,
  usePagination, Pagination,
  type RiskLevel,
} from "@/components/portal/ui"
import { AssetSlideover, type AssetDetail } from "@/components/portal/asset-slideover"
import { useToast } from "@/components/portal/toast"
import { useRole } from "@/components/portal/role-context"
import { cn } from "@/lib/utils"

type Asset  = Tables<"assets">
type Server = Tables<"servers">
type Category = Asset["category"]
type SortDir  = "asc" | "desc"
type SortKey  = keyof Asset | "none"

/* ── 컬럼 정의 ─────────────────────────────────────────── */
type ColKey =
  | "id" | "name" | "vendor" | "category" | "version"
  | "server" | "owner" | "vuln" | "patch" | "eos"
  | "approval" | "checked_at"

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "id",         label: "자산 ID"    },
  { key: "name",       label: "제품명"     },
  { key: "vendor",     label: "벤더"       },
  { key: "category",   label: "분류"       },
  { key: "version",    label: "현재 버전"  },
  { key: "server",     label: "설치 서버"  },
  { key: "owner",      label: "담당자"     },
  { key: "vuln",       label: "취약점"     },
  { key: "patch",      label: "패치 상태"  },
  { key: "eos",        label: "EOS 날짜"   },
  { key: "approval",   label: "승인 상태"  },
  { key: "checked_at", label: "최근 확인일"},
]

const FACTORY_VISIBLE: ColKey[] = [
  "id", "name", "vendor", "category", "version",
  "server", "owner", "vuln", "patch", "eos", "checked_at",
]
const LS_KEY = "sw_manager_col_visible"

/* ── 필터 옵션 ──────────────────────────────────────────── */
const CATEGORIES: (Category | "전체")[] = ["전체", "OS", "WEB", "WAS", "DB", "Middleware", "Security"]
const STATUS_FILTERS = ["전체", "정상", "취약점 있음", "패치 필요", "EOS 임박", "승인 대기"] as const

/* ── 정렬 가중치 ────────────────────────────────────────── */
const vulnOrder:  Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const patchOrder: Record<string, number> = { "Patch Required": 0, "Patch Available": 1, "Up to Date": 2 }

/* ── 배지 매핑 ──────────────────────────────────────────── */
const vulnRisk:  Record<string, RiskLevel> = { Critical: 5, High: 4, Medium: 3, Low: 2 }
const vulnLabel:   Record<string, string> = { Critical: "긴급", High: "높음", Medium: "보통", Low: "낮음" }
const patchRisk: Record<string, RiskLevel> = { "Patch Required": 4, "Patch Available": 3, "Up to Date": 1 }
const patchLabel:  Record<string, string> = { "Patch Required": "패치 필요", "Patch Available": "패치 가능", "Up to Date": "최신" }
const approvalRisk: Record<string, RiskLevel> = { 승인대기: 3, 확인필요: 4, 승인완료: 1, 긴급: 5 }

/* ── 헬퍼 ──────────────────────────────────────────────── */
function isEosSoon(eos: string | null) {
  if (!eos) return false
  return new Date(eos).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 200
}
function isEosExpired(eos: string | null) {
  if (!eos) return false
  return new Date(eos).getTime() < Date.now()
}
function daysUntil(date: string | null) {
  if (!date) return 0
  return Math.round((new Date(date).getTime() - Date.now()) / 86400000)
}
function formatChecked(ts: string | null) {
  if (!ts) return "-"
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
  if (days === 0) return "오늘"
  if (days === 1) return "어제"
  return `${days}일 전`
}
function excelValue(a: Asset, key: ColKey): string | number {
  switch (key) {
    case "vuln": return vulnLabel[a.vuln]
    case "patch": return patchLabel[a.patch]
    case "checked_at": return formatChecked(a.checked_at)
    case "eos": return a.eos ?? "-"
    default: return a[key] ?? ""
  }
}
function toDetail(a: Asset): AssetDetail {
  return {
    id: a.id, name: a.name, vendor: a.vendor, category: a.category,
    version: a.version, latest: a.latest_version ?? a.version,
    server: a.server, owner: a.owner, vuln: a.vuln,
    patch: patchLabel[a.patch], patchRisk: patchRisk[a.patch],
    vulnRisk: vulnRisk[a.vuln], eos: a.eos ?? "-",
    eosDaysLeft: daysUntil(a.eos), approval: a.approval,
    approvalRisk: approvalRisk[a.approval],
  }
}

/* ── 행별 수정 패널 (담당자/설치 서버/승인 상태만) ─────────── */
type AssetEditValues = { owner: string; server: string; approval: Asset["approval"] }
const APPROVAL_OPTIONS: Asset["approval"][] = ["승인대기", "확인필요", "승인완료", "긴급"]

function AssetEditFormPanel({
  initial,
  servers,
  onCancel,
  onSubmit,
}: {
  initial: AssetEditValues
  servers: Server[]
  onCancel: () => void
  onSubmit: (values: AssetEditValues) => void
}) {
  const [values, setValues] = useState<AssetEditValues>(initial)
  const inputCls =
    "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">담당자</span>
        <input
          value={values.owner}
          onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">설치 서버</span>
        <select
          value={values.server}
          onChange={(e) => setValues((v) => ({ ...v, server: e.target.value }))}
          className={inputCls}
        >
          {servers.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">승인 상태</span>
        <select
          value={values.approval}
          onChange={(e) => setValues((v) => ({ ...v, approval: e.target.value as Asset["approval"] }))}
          className={inputCls}
        >
          {APPROVAL_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
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

/* ── 메인 컴포넌트 ──────────────────────────────────────── */
export function AssetsView() {
  const { toast } = useToast()
  const { isAdmin } = useRole()
  const [assets,  setAssets]  = useState<Asset[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState("")
  const [cat,     setCat]     = useState<(typeof CATEGORIES)[number]>("전체")
  const [status,  setStatus]  = useState<(typeof STATUS_FILTERS)[number]>("전체")
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [visible, setVisible] = useState<ColKey[]>(() => loadColumnVisibility(LS_KEY, FACTORY_VISIBLE))
  const [selected, setSelected] = useState<AssetDetail | null>(null)
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false)
  const [editPanel, setEditPanel] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("servers").select("*"),
    ]).then(([assetRes, serverRes]) => {
      if (assetRes.data) setAssets(assetRes.data)
      if (serverRes.data) setServers(serverRes.data)
      setLoading(false)
    })
  }, [])

  async function saveAssetEdit(assetId: string, values: AssetEditValues) {
    const supabase = createClient()
    const { error } = await supabase.from("assets").update(values).eq("id", assetId)
    if (error) {
      toast({ tone: "danger", title: "자산 수정 실패", description: error.message })
      return
    }
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...values } : a)))
    setEditPanel(null)
    toast({ tone: "success", title: "자산 정보가 수정되었습니다" })
  }

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(col); setSortDir("asc") }
    pagination.setPage(1)
  }

  const filtered = useMemo(() => {
    const base = assets.filter((a) => {
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || [a.name, a.vendor, a.version, a.owner, a.server].some((f) => f.toLowerCase().includes(q))
      const matchesCat   = cat === "전체" || a.category === cat
      const matchesStatus =
        status === "전체" ||
        (status === "정상"       && a.vuln === "Low" && a.patch === "Up to Date") ||
        (status === "취약점 있음" && (a.vuln === "Critical" || a.vuln === "High")) ||
        (status === "패치 필요"   && a.patch === "Patch Required") ||
        (status === "EOS 임박"    && isEosSoon(a.eos)) ||
        (status === "승인 대기"   && (a.approval === "승인대기" || a.approval === "긴급"))
      return matchesQuery && matchesCat && matchesStatus
    })

    return [...base].sort((a, b) => {
      if (sortKey === "vuln")  { const d = vulnOrder[a.vuln]  - vulnOrder[b.vuln];  return sortDir === "asc" ? d : -d }
      if (sortKey === "patch") { const d = patchOrder[a.patch] - patchOrder[b.patch]; return sortDir === "asc" ? d : -d }
      if (sortKey === "eos" || sortKey === "checked_at" || sortKey === "created_at") {
        const va = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0
        const vb = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0
        return sortDir === "asc" ? va - vb : vb - va
      }
      const va = String(a[sortKey as keyof Asset] ?? "")
      const vb = String(b[sortKey as keyof Asset] ?? "")
      return sortDir === "asc" ? va.localeCompare(vb, "ko") : vb.localeCompare(va, "ko")
    })
  }, [assets, query, cat, status, sortKey, sortDir])

  const show = (key: ColKey) => visible.includes(key)
  const stProps = { sortKey, sortDir, onSort: handleSort }
  const pagination = usePagination(filtered)

  const detailFilterCount = [cat, status].filter((v) => v !== "전체").length
  const filterChips: { key: string; label: string; onRemove: () => void }[] = []
  if (cat !== "전체") filterChips.push({ key: "cat", label: cat, onRemove: () => setCat("전체") })
  if (status !== "전체") filterChips.push({ key: "status", label: status, onRemove: () => setStatus("전체") })

  function resetFilters() {
    setQuery("")
    setCat("전체")
    setStatus("전체")
    pagination.setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Boxes}
        title="자산 목록"
        description={
          isAdmin
            ? "등록된 전체 소프트웨어 자산을 관리합니다."
            : "담당하거나 조회 권한이 있는 소프트웨어 자산을 확인합니다."
        }
      />

      {/* 검색 + 필터 */}
      <div className="glow-card animate-rise flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        {/* 기본 검색 한 줄 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
              placeholder="제품명, 벤더, 버전, 담당자, 서버명 검색"
              className="w-full rounded-lg border border-border/60 bg-background/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

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
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => { setCat(c); pagination.setPage(1) }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    cat === c ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}>
                  {c}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">상태</span>
              {STATUS_FILTERS.map((s) => (
                <button key={s} type="button" onClick={() => { setStatus(s); pagination.setPage(1) }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    status === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}>
                  {s}
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

      {/* 테이블 헤더 */}
      <div className="animate-rise">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-mono font-semibold text-foreground">{filtered.length}</span>건
            {loading && <span className="ml-2 text-xs">불러오는 중…</span>}
          </p>
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={filtered}
              filename="자산_목록"
              columns={ALL_COLS.filter((c) => show(c.key)).map((c) => ({
                label: c.label,
                value: (a: Asset) => excelValue(a, c.key),
              }))}
            />
            <ColumnVisibilityMenu
              allCols={ALL_COLS}
              visible={visible}
              onChange={setVisible}
              factoryDefault={FACTORY_VISIBLE}
              storageKey={LS_KEY}
            />
          </div>
        </div>

        <TableShell scrollHint>
          <thead>
            <tr>
              {show("id")         && <SortTh col="id"         label="자산 ID"   {...stProps} />}
              {show("name")       && <SortTh col="name"       label="제품명"    {...stProps} />}
              {show("vendor")     && <SortTh col="vendor"     label="벤더"      {...stProps} />}
              {show("category")   && <SortTh col="category"   label="분류"      {...stProps} />}
              {show("version")    && <SortTh col="version"    label="현재 버전" {...stProps} />}
              {show("server")     && <SortTh col="server"     label="설치 서버" {...stProps} />}
              {show("owner")      && <SortTh col="owner"      label="담당자"    {...stProps} />}
              {show("vuln")       && <SortTh col="vuln"       label="취약점"    {...stProps} />}
              {show("patch")      && <SortTh col="patch"      label="패치 상태" {...stProps} />}
              {show("eos")        && <SortTh col="eos"        label="EOS 날짜"  {...stProps} />}
              {show("approval")   && <SortTh col="approval"   label="승인 상태" {...stProps} />}
              {show("checked_at") && <SortTh col="checked_at" label="최근 확인일" {...stProps} />}
              <Th className={TABLE_HEADER_CELL_H}>상세정보</Th>
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((a) => {
              const sv = servers.find((s) => s.name === a.server)
              if (editPanel === a.id) {
                return (
                  <tr key={a.id}>
                    <td colSpan={visible.length + 1} className="border-b border-border/40 p-0">
                      <AssetEditFormPanel
                        initial={{ owner: a.owner, server: a.server, approval: a.approval }}
                        servers={servers}
                        onCancel={() => setEditPanel(null)}
                        onSubmit={(values) => saveAssetEdit(a.id, values)}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
                  {show("id")       && <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{a.id}</Td>}
                  {show("name")     && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{a.name}</Td>}
                  {show("vendor")   && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{a.vendor}</Td>}
                  {show("category") && <Td className={TABLE_ROW_CELL_H}><StatusBadge accent="primary">{a.category}</StatusBadge></Td>}
                  {show("version")  && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{a.version}</Td>}
                  {show("server")   && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-foreground">{a.server}</span>
                        {sv && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {sv.hostname} · {sv.ip}
                          </span>
                        )}
                      </div>
                    </Td>
                  )}
                  {show("owner")    && <Td className={TABLE_ROW_CELL_H}>{a.owner}</Td>}
                  {show("vuln")     && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={vulnRisk[a.vuln]} pulse={a.vuln === "Critical"}>
                        {vulnLabel[a.vuln]}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("patch")    && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={patchRisk[a.patch]}>{patchLabel[a.patch]}</StatusBadge>
                    </Td>
                  )}
                  {show("eos")      && (
                    <Td className={cn(
                      "font-mono text-xs",
                      TABLE_ROW_CELL_H,
                      isEosExpired(a.eos) ? "text-destructive font-semibold" : isEosSoon(a.eos) ? "text-eos" : "",
                    )}>
                      {a.eos ?? "-"}
                      {isEosExpired(a.eos) && <span className="ml-1 text-[10px]">[만료]</span>}
                    </Td>
                  )}
                  {show("approval") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={approvalRisk[a.approval]} pulse={a.approval === "긴급"}>
                        {a.approval}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("checked_at") && (
                    <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{formatChecked(a.checked_at)}</Td>
                  )}
                  <Td className={TABLE_ROW_CELL_H}>
                    <div className="flex items-center gap-1.5">
                      <MiniButton accent="primary" onClick={() => setSelected(toDetail(a))}>
                        <Eye className="h-3 w-3" />상세
                      </MiniButton>
                      {isAdmin && (
                        <MiniButton accent="muted" onClick={() => setEditPanel(a.id)}>
                          <Pencil className="h-3 w-3" />수정
                        </MiniButton>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 결과가 없습니다.</span>
                </Td>
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
      </div>

      <AssetSlideover asset={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
