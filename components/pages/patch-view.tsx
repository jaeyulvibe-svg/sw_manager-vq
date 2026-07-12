// components/pages/patch-view.tsx
"use client"

import { Fragment, useMemo, useState } from "react"
import {
  ShieldCheck,
  Search,
  ListChecks,
  Flame,
  AlertTriangle,
  PackageX,
  ArrowRight,
  Server,
  ChevronUp,
  ChevronDown,
  RotateCcw,
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
  ExportExcelButton,
  SortTh,
  ColumnVisibilityMenu,
  loadColumnVisibility,
  TABLE_HEADER_CELL_H,
  TABLE_ROW_CELL_H,
  usePagination,
  Pagination,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { useNoticeData, type Vulnerability } from "@/components/pages/notice-board/use-notice-data"
import type { ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"

type Severity = Vulnerability["severity"]
type SourceType = Vulnerability["source_type"]
type NoticeType = Vulnerability["notice_type"]

const sevRisk: Record<Severity, RiskLevel> = { Critical: 5, High: 4, Medium: 3, Low: 2 }
const sourceTypeLabel: Record<SourceType, string> = { kisa: "KISA", vendor: "제조사" }
const noticeTypeAccent: Record<NoticeType, Accent> = { CVE: "destructive", Patch: "warning", EOS: "eos" }

const SEVERITIES: (Severity | "전체")[] = ["전체", "Critical", "High", "Medium", "Low"]
const SOURCE_TYPES: (SourceType | "전체")[] = ["전체", "kisa", "vendor"]
const NOTICE_TYPES: (NoticeType | "전체")[] = ["전체", "CVE", "Patch", "EOS"]

type ColKey = "severity" | "cve" | "title" | "noticeType" | "sourceType" | "source" | "product" | "mapped"
const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "severity", label: "심각도" },
  { key: "cve", label: "CVE" },
  { key: "title", label: "제목" },
  { key: "noticeType", label: "공지 유형" },
  { key: "sourceType", label: "출처 유형" },
  { key: "source", label: "출처" },
  { key: "product", label: "영향 제품" },
  { key: "mapped", label: "매핑 자산 수" },
]
const FACTORY_VISIBLE: ColKey[] = ALL_COLS.map((c) => c.key)
const LS_KEY = "patch_view_columns"

type SortKey = ColKey | "none"
type SortDir = "asc" | "desc"

function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

export function PatchView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const { vulns, matchMap, loading } = useNoticeData()
  const [query, setQuery] = useState("")
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("전체")
  const [sourceType, setSourceType] = useState<(typeof SOURCE_TYPES)[number]>("전체")
  const [noticeType, setNoticeType] = useState<(typeof NOTICE_TYPES)[number]>("전체")
  const [sortKey, setSortKey] = useState<SortKey>("severity")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [visible, setVisible] = useState<ColKey[]>(() => loadColumnVisibility(LS_KEY, FACTORY_VISIBLE))
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const approved = useMemo(() => vulns.filter((v) => v.approval === "승인완료"), [vulns])

  const stats = useMemo(() => {
    const critical = approved.filter((v) => v.severity === "Critical").length
    const high = approved.filter((v) => v.severity === "High").length
    const unmapped = approved.filter((v) => (matchMap.get(v.id)?.length ?? 0) === 0).length
    return { total: approved.length, critical, high, unmapped }
  }, [approved, matchMap])

  function sortValue(v: Vulnerability, key: SortKey): string | number {
    if (key === "severity") return sevRisk[v.severity]
    if (key === "mapped") return matchMap.get(v.id)?.length ?? 0
    if (key === "sourceType") return sourceTypeLabel[v.source_type]
    if (key === "noticeType") return v.notice_type
    if (key === "none") return 0
    return String(v[key as "cve" | "title" | "source" | "product"])
  }

  const filteredSorted = useMemo(() => {
    return [...approved]
      .filter((v) => {
        const q = query.trim().toLowerCase()
        const matchesQuery =
          !q || [v.title, v.cve, v.product, v.source].some((f) => f.toLowerCase().includes(q))
        const matchesSeverity = severity === "전체" || v.severity === severity
        const matchesSourceType = sourceType === "전체" || v.source_type === sourceType
        const matchesNoticeType = noticeType === "전체" || v.notice_type === noticeType
        return matchesQuery && matchesSeverity && matchesSourceType && matchesNoticeType
      })
      .sort((a, b) => {
        const va = sortValue(a, sortKey)
        const vb = sortValue(b, sortKey)
        const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
        return sortDir === "asc" ? d : -d
      })
  }, [approved, query, severity, sourceType, noticeType, sortKey, sortDir, matchMap])

  const pagination = usePagination(filteredSorted)

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
    pagination.setPage(1)
  }

  const show = (key: ColKey) => visible.includes(key)

  const filterChips: { key: string; label: string; onRemove: () => void }[] = []
  if (severity !== "전체") filterChips.push({ key: "severity", label: severity, onRemove: () => setSeverity("전체") })
  if (sourceType !== "전체") {
    filterChips.push({
      key: "sourceType",
      label: sourceTypeLabel[sourceType as SourceType],
      onRemove: () => setSourceType("전체"),
    })
  }
  if (noticeType !== "전체") {
    filterChips.push({ key: "noticeType", label: noticeType, onRemove: () => setNoticeType("전체") })
  }

  function resetFilters() {
    setQuery("")
    setSeverity("전체")
    setSourceType("전체")
    setNoticeType("전체")
    pagination.setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldCheck}
        title="승인된 취약점 공지"
        description="KISA·제조사에서 승인 완료된 취약점·EOS 공지를 전사 자산 매핑 기준으로 조회합니다. 신규 미승인 공지는 KISA/제조사/EOS 공지 화면에서 검토·승인하세요."
        action={
          onNavigate ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <MiniButton accent="primary" onClick={() => onNavigate("kisa")}>
                KISA 취약점 공지 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
              <MiniButton accent="primary" onClick={() => onNavigate("vendor")}>
                제조사 취약점 공지 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
              <MiniButton accent="eos" onClick={() => onNavigate("eos-notice")}>
                EOS 공지 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 승인 건수" value={stats.total} icon={ListChecks} accent="primary" delay={80} />
        <StatCard label="CRITICAL" value={stats.critical} icon={Flame} risk={5} delay={180} />
        <StatCard label="HIGH" value={stats.high} icon={AlertTriangle} risk={4} delay={280} />
        <StatCard label="미매핑" value={stats.unmapped} icon={PackageX} accent="eos" delay={380} />
      </div>

      <SectionCard
        title="승인된 공지 목록"
        subtitle="승인 완료된 취약점·EOS 공지와 매핑된 자산 현황입니다"
        icon={ShieldCheck}
        action={
          <div className="flex items-center gap-1.5">
            <ExportExcelButton
              rows={filteredSorted}
              filename="승인된_취약점_공지"
              columns={[
                { label: "심각도", value: (v: Vulnerability) => v.severity },
                { label: "CVE", value: (v: Vulnerability) => v.cve },
                { label: "제목", value: (v: Vulnerability) => v.title },
                { label: "공지 유형", value: (v: Vulnerability) => v.notice_type },
                { label: "출처 유형", value: (v: Vulnerability) => sourceTypeLabel[v.source_type] },
                { label: "출처", value: (v: Vulnerability) => v.source },
                { label: "영향 제품", value: (v: Vulnerability) => v.product },
                { label: "매핑 자산 수", value: (v: Vulnerability) => matchMap.get(v.id)?.length ?? 0 },
              ]}
            />
            <ColumnVisibilityMenu
              allCols={ALL_COLS}
              visible={visible}
              onChange={setVisible}
              factoryDefault={FACTORY_VISIBLE}
              storageKey={LS_KEY}
            />
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                placeholder="제목, CVE, 제품명, 출처 검색"
                className="w-full rounded-lg border border-border/60 bg-background/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <MiniButton
              onClick={() => setDetailFiltersOpen((v) => !v)}
              className={cn(detailFiltersOpen && "border-primary/50 bg-primary/10 text-primary")}
            >
              상세 필터{filterChips.length > 0 ? ` (${filterChips.length})` : ""}
              {detailFiltersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </MiniButton>
            <MiniButton onClick={resetFilters}>
              <RotateCcw className="h-3 w-3" />
              초기화
            </MiniButton>
          </div>

          {detailFiltersOpen ? (
            <div className="animate-rise flex flex-col gap-3 border-t border-border/50 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">심각도</span>
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSeverity(s); pagination.setPage(1) }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      severity === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">출처 유형</span>
                {SOURCE_TYPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSourceType(s); pagination.setPage(1) }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      sourceType === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s === "전체" ? s : sourceTypeLabel[s]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">공지 유형</span>
                {NOTICE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setNoticeType(t); pagination.setPage(1) }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      noticeType === t ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
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

        <p className="mb-3 text-sm text-muted-foreground">
          총 <span className="font-mono font-semibold text-foreground">{filteredSorted.length}</span>건
          {loading && <span className="ml-2 text-xs">불러오는 중…</span>}
        </p>

        <TableShell scrollHint>
          <thead>
            <tr>
              {show("severity") && <SortTh col="severity" label="심각도" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("cve") && <SortTh col="cve" label="CVE" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("title") && <SortTh col="title" label="제목" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("noticeType") && <SortTh col="noticeType" label="공지 유형" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("sourceType") && <SortTh col="sourceType" label="출처 유형" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("source") && <SortTh col="source" label="출처" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("product") && <SortTh col="product" label="영향 제품" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("mapped") && <SortTh col="mapped" label="매핑 자산 수" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              <Th className={TABLE_HEADER_CELL_H}>작업</Th>
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((v) => {
              const matched = matchMap.get(v.id) ?? []
              const expanded = expandedId === v.id
              return (
                <Fragment key={v.id}>
                  <tr className="transition-colors hover:bg-accent/40">
                    {show("severity") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge risk={sevRisk[v.severity]} pulse={v.severity === "Critical"}>{v.severity}</StatusBadge>
                      </Td>
                    )}
                    {show("cve") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{v.cve}</Td>}
                    {show("title") && <Td className={cn("whitespace-normal text-xs", TABLE_ROW_CELL_H)}>{v.title}</Td>}
                    {show("noticeType") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge accent={noticeTypeAccent[v.notice_type]}>{v.notice_type}</StatusBadge>
                      </Td>
                    )}
                    {show("sourceType") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge accent={v.source_type === "kisa" ? "primary" : "muted"}>
                          {sourceTypeLabel[v.source_type]}
                        </StatusBadge>
                      </Td>
                    )}
                    {show("source") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{v.source}</Td>}
                    {show("product") && <Td className={cn("text-xs", TABLE_ROW_CELL_H)}>{v.product}</Td>}
                    {show("mapped") && <Td className={TABLE_ROW_CELL_H}>{matched.length}대</Td>}
                    <Td className={TABLE_ROW_CELL_H}>
                      <MiniButton accent="primary" onClick={() => setExpandedId(expanded ? null : v.id)}>
                        <Server className="h-3 w-3" />
                        매핑 자산{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </MiniButton>
                    </Td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={ALL_COLS.length + 1} className="border-b border-border/40 bg-background/40 px-3 py-3">
                        {matched.length > 0 ? (
                          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {matched.map((a) => (
                              <li key={a.id} className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
                                <span className="font-mono">{a.id}</span> · {a.name} · {a.server} · {a.owner}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">매칭되는 자산이 없습니다.</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground">수집 일시: {formatCollected(v.collected_at)}</p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {!loading && pagination.pageItems.length === 0 && (
              <tr>
                <td colSpan={ALL_COLS.length + 1} className="py-8 text-center text-muted-foreground">
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
