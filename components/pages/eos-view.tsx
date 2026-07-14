"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarClock,
  CalendarX,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  ProgressBar,
  TableShell,
  Td,
  ExportExcelButton,
  SortTh,
  ColumnVisibilityMenu,
  loadColumnVisibility,
  TABLE_ROW_CELL_H,
  usePagination,
  Pagination,
  type RiskLevel,
} from "@/components/portal/ui"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"

type Asset = Tables<"assets">
type Risk = "Critical" | "High" | "Medium" | "Low"
type EosRow = Asset & {
  eos: string
  days: number
  remain: string
  remainPct: number
  risk: Risk
  action: string
}

const riskLevelMap: Record<Risk, RiskLevel> = {
  Critical: 5, High: 4, Medium: 3, Low: 2,
}
const riskLabel: Record<Risk, string> = {
  Critical: "긴급", High: "높음", Medium: "보통", Low: "낮음",
}

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function riskFromDays(days: number): Risk {
  if (days <= 90) return "Critical"
  if (days <= 182) return "High"
  if (days <= 365) return "Medium"
  return "Low"
}

const actionLabel: Record<Risk, string> = {
  Critical: "긴급 검토", High: "업그레이드 검토", Medium: "패치 계획", Low: "정상",
}

/* ---- EOS 위험 자산 표: 컬럼 정의 + 정렬/검색 (조회 전용 — 편집 기능 없음) ---- */
type EosColKey =
  | "name" | "version" | "vendor" | "server" | "owner"
  | "eos" | "remain" | "remainPct" | "risk" | "action"

const EOS_ALL_COLS: { key: EosColKey; label: string }[] = [
  { key: "name", label: "제품명" },
  { key: "version", label: "현재 버전" },
  { key: "vendor", label: "벤더" },
  { key: "server", label: "설치 서버" },
  { key: "owner", label: "담당자" },
  { key: "eos", label: "EOS 날짜" },
  { key: "remain", label: "남은 기간" },
  { key: "remainPct", label: "잔여 수명" },
  { key: "risk", label: "영향도" },
  { key: "action", label: "조치 상태" },
]
const EOS_FACTORY_VISIBLE: EosColKey[] = EOS_ALL_COLS.map((c) => c.key)
const EOS_LS_KEY = "eos_view_columns"

type EosSortKey = EosColKey | "none"

function eosSortValue(it: EosRow, key: EosSortKey): string | number {
  if (key === "risk") return riskLevelMap[it.risk]
  if (key === "remain") return it.days
  if (key === "remainPct") return it.remainPct
  if (key === "none") return 0
  return it[key]
}

function enrichAsset(a: Asset & { eos: string }): EosRow {
  const days = daysUntil(a.eos)
  return {
    ...a,
    days,
    remain: days < 0 ? "만료" : days <= 365 ? `${days}일` : "장기",
    remainPct: Math.max(0, Math.min(100, Math.round((days / (365 * 2)) * 100))),
    risk: riskFromDays(days),
    action: actionLabel[riskFromDays(days)],
  }
}

/** EOS 날짜 기준 상호 배타적 위험 구간별 자산 건수 */
function countByEosWindow(assets: Asset[]) {
  let expired = 0
  let within3m = 0
  let within6m = 0
  let within12m = 0
  for (const a of assets) {
    if (!a.eos) continue
    const days = daysUntil(a.eos)
    if (days < 0) expired++
    else if (days <= 90) within3m++
    else if (days <= 182) within6m++
    else if (days <= 365) within12m++
  }
  return { expired, within3m, within6m, within12m }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** 오늘이 속한 달부터 11개월 뒤까지, 12개월 롤링 윈도우로 월별 EOS 건수를 집계한다. */
function buildMonthlyBuckets(assets: Asset[]) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const buckets: { month: string; label: string; count: number }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    buckets.push({
      month: monthKey(d),
      label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
    })
  }
  const bucketByMonth = new Map(buckets.map((b) => [b.month, b]))
  for (const a of assets) {
    if (!a.eos) continue
    const eosDate = new Date(a.eos)
    if (isNaN(eosDate.getTime())) continue
    const bucket = bucketByMonth.get(monthKey(eosDate))
    if (bucket) bucket.count += 1
  }
  return buckets
}

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-eos/40 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">
        EOS 예정:{" "}
        <span className="font-mono font-semibold text-eos">{payload[0].value}건</span>
      </p>
    </div>
  )
}

type EosSyncResult = {
  product: string
  ok: boolean
  updatedAssets: number
  unmatchedAssets: string[]
  error?: string
}

export function EosView() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const { isAdmin } = useRole()
  const { toast } = useToast()

  function loadAssets() {
    const supabase = createClient()
    supabase
      .from("assets")
      .select("*")
      .then(({ data }) => {
        if (data) setAssets(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadAssets()
  }, [])

  async function syncEosInfo() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch("/api/eos-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ tone: "danger", title: "EOS 정보 동기화 실패", description: data.error ?? "알 수 없는 오류" })
        return
      }
      const results: EosSyncResult[] = data.results ?? []
      const succeeded = results.filter((r) => r.ok)
      const failed = results.filter((r) => !r.ok)
      const totalUpdated = succeeded.reduce((sum, r) => sum + r.updatedAssets, 0)
      const totalUnmatched = results.reduce((sum, r) => sum + r.unmatchedAssets.length, 0)

      loadAssets()

      if (failed.length === 0) {
        toast({
          tone: "success",
          title: "EOS 정보 동기화 완료",
          description: `대상 제품 ${results.length}개 · 갱신된 자산 ${totalUpdated}건${totalUnmatched > 0 ? ` · 매칭 실패 ${totalUnmatched}건` : ""}`,
        })
      } else {
        toast({
          tone: succeeded.length > 0 ? "info" : "danger",
          title: succeeded.length > 0 ? "EOS 정보 동기화 일부 실패" : "EOS 정보 동기화 전체 실패",
          description: failed.map((f) => `${f.product}: ${f.error}`).join(" / "),
        })
      }
    } catch {
      toast({ tone: "danger", title: "EOS 정보 동기화 중 오류가 발생했습니다" })
    } finally {
      setSyncing(false)
    }
  }

  const { expired, within3m, within6m, within12m } = useMemo(() => countByEosWindow(assets), [assets])
  const timeline = useMemo(() => buildMonthlyBuckets(assets), [assets])
  const eosRows = useMemo(
    () =>
      assets
        .filter((a): a is Asset & { eos: string } => !!a.eos)
        .map(enrichAsset)
        .sort((a, b) => a.days - b.days),
    [assets],
  )

  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<EosSortKey>("remain")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [visible, setVisible] = useState<EosColKey[]>(() =>
    loadColumnVisibility(EOS_LS_KEY, EOS_FACTORY_VISIBLE),
  )

  function handleSort(col: EosSortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return eosRows
      .filter((it) => {
        if (!q) return true
        return [it.name, it.vendor, it.version, it.owner, it.server].some((f) =>
          f.toLowerCase().includes(q),
        )
      })
      .sort((a, b) => {
        const va = eosSortValue(a, sortKey)
        const vb = eosSortValue(b, sortKey)
        const d =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "ko")
        return sortDir === "asc" ? d : -d
      })
  }, [eosRows, query, sortKey, sortDir])

  const show = (key: EosColKey) => visible.includes(key)
  const pagination = usePagination(filteredRows)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={CalendarClock}
        title="EOS 로드맵"
        description="SW 자산별 EOS/EOL 일정을 월별로 추적하고 지원 종료 위험을 사전에 관리합니다."
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={syncEosInfo}
              disabled={syncing}
              className="glow-card inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ? "동기화 중…" : "EOS 정보 동기화"}
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="만료자산" value={expired} icon={CalendarX} risk={5} delay={80} />
        <StatCard label="3개월 이내" value={within3m} icon={CalendarClock} risk={4} delay={180} />
        <StatCard label="6개월 이내" value={within6m} icon={CalendarDays} risk={3} delay={280} />
        <StatCard label="12개월 이내" value={within12m} icon={CalendarRange} risk={2} delay={380} />
      </div>

      <SectionCard
        title="월별 EOS 일정"
        subtitle="이번 달부터 12개월간 지원 종료 예정 자산 분포"
        icon={CalendarClock}
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeline} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--eos)", fillOpacity: 0.08 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={46} animationDuration={1400}>
                {timeline.map((t, i) => (
                  <Cell key={i} fill={t.count >= 3 ? "var(--eos)" : "var(--primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="EOS 위험 자산"
        subtitle="지원 종료 임박 자산 조치 현황"
        icon={AlertTriangle}
        action={
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                placeholder="제품명, 벤더, 버전, 담당자, 서버명 검색"
                className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>
            <ExportExcelButton
              rows={filteredRows}
              filename="EOS_위험_자산"
              columns={[
                { label: "제품명", value: (it: EosRow) => it.name },
                { label: "현재 버전", value: (it: EosRow) => it.version },
                { label: "벤더", value: (it: EosRow) => it.vendor },
                { label: "설치 서버", value: (it: EosRow) => it.server },
                { label: "담당자", value: (it: EosRow) => it.owner },
                { label: "EOS 날짜", value: (it: EosRow) => it.eos },
                { label: "남은 기간", value: (it: EosRow) => it.remain },
                { label: "잔여 수명(%)", value: (it: EosRow) => it.remainPct },
                { label: "영향도", value: (it: EosRow) => riskLabel[it.risk] },
                { label: "조치 상태", value: (it: EosRow) => it.action },
              ]}
            />
            <ColumnVisibilityMenu
              allCols={EOS_ALL_COLS}
              visible={visible}
              onChange={setVisible}
              factoryDefault={EOS_FACTORY_VISIBLE}
              storageKey={EOS_LS_KEY}
            />
          </div>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
        ) : eosRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">EOS 날짜가 등록된 자산이 없습니다.</p>
        ) : (
          <TableShell scrollHint>
            <thead>
              <tr>
                {show("name") && <SortTh col="name" label="제품명" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("version") && <SortTh col="version" label="현재 버전" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("vendor") && <SortTh col="vendor" label="벤더" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("server") && <SortTh col="server" label="설치 서버" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("owner") && <SortTh col="owner" label="담당자" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("eos") && <SortTh col="eos" label="EOS 날짜" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("remain") && <SortTh col="remain" label="남은 기간" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("remainPct") && <SortTh col="remainPct" label="잔여 수명" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="min-w-40" />}
                {show("risk") && <SortTh col="risk" label="영향도" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
                {show("action") && <SortTh col="action" label="조치 상태" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((it) => {
                const soon = it.remainPct <= 35
                return (
                  <tr key={it.id} className="transition-colors hover:bg-accent/40">
                    {show("name") && (
                      <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>
                        <span className="flex items-center gap-1.5">
                          {soon ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-eos" />
                          ) : (
                            <CircleCheck className="h-3.5 w-3.5 text-success" />
                          )}
                          {it.name}
                        </span>
                      </Td>
                    )}
                    {show("version") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{it.version}</Td>}
                    {show("vendor") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{it.vendor}</Td>}
                    {show("server") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{it.server}</Td>}
                    {show("owner") && <Td className={TABLE_ROW_CELL_H}>{it.owner}</Td>}
                    {show("eos") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge accent="eos">{it.eos}</StatusBadge>
                      </Td>
                    )}
                    {show("remain") && (
                      <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H, soon && "font-bold text-eos")}>
                        {it.remain}
                      </Td>
                    )}
                    {show("remainPct") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={it.remainPct}
                            risk={
                              it.remainPct <= 20
                                ? 5
                                : it.remainPct <= 35
                                  ? 4
                                  : it.remainPct <= 50
                                    ? 3
                                    : it.remainPct <= 70
                                      ? 2
                                      : 1
                            }
                            className="w-24"
                          />
                          <span className="font-mono text-xs text-muted-foreground">{it.remainPct}%</span>
                        </div>
                      </Td>
                    )}
                    {show("risk") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge risk={riskLevelMap[it.risk]} pulse={it.risk === "Critical"}>
                          {riskLabel[it.risk]}
                        </StatusBadge>
                      </Td>
                    )}
                    {show("action") && <Td className={cn("text-sm", TABLE_ROW_CELL_H)}>{it.action}</Td>}
                  </tr>
                )
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visible.length}
                    className="border-b border-border/40 px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    검색 조건에 맞는 자산이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </TableShell>
        )}
        {!loading && filteredRows.length > 0 && (
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
