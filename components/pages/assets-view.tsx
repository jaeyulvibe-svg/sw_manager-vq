"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Boxes, Search, Eye, Pencil, RefreshCw,
  ChevronUp, ChevronDown, ChevronsUpDown, SlidersHorizontal, Check,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import {
  PageHeader, StatusBadge, TableShell, Th, Td, MiniButton, type RiskLevel,
} from "@/components/portal/ui"
import { AssetSlideover, type AssetDetail } from "@/components/portal/asset-slideover"
import { useToast } from "@/components/portal/toast"
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
  "server", "owner", "vuln", "patch", "eos", "approval", "checked_at",
]
const LS_KEY = "sw_manager_col_visible"
const LS_DEFAULT_KEY = "sw_manager_col_default"

function loadVisible(): ColKey[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as ColKey[]
  } catch {}
  return loadUserDefault()
}
function saveVisible(cols: ColKey[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(cols))
}
function loadUserDefault(): ColKey[] {
  try {
    const raw = localStorage.getItem(LS_DEFAULT_KEY)
    if (raw) return JSON.parse(raw) as ColKey[]
  } catch {}
  return FACTORY_VISIBLE
}
function saveUserDefault(cols: ColKey[]) {
  localStorage.setItem(LS_DEFAULT_KEY, JSON.stringify(cols))
}

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

/* ── 정렬 헤더 ──────────────────────────────────────────── */
function SortTh({ col, label, sortKey, sortDir, onSort }: {
  col: SortKey; label: string; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void
}) {
  const active = sortKey === col
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap border-b border-border/60 bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
        active && "text-primary",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === "asc"
            ? <ChevronUp className="h-3 w-3 text-primary" />
            : <ChevronDown className="h-3 w-3 text-primary" />
          : <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  )
}

/* ── 컬럼 토글 드롭다운 ─────────────────────────────────── */
function ColToggle({
  visible, onChange,
}: {
  visible: ColKey[]
  onChange: (cols: ColKey[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function toggle(key: ColKey) {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]
    onChange(next)
    saveVisible(next)
  }

  function handleSaveDefault() {
    saveUserDefault(visible)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleResetDefault() {
    const def = loadUserDefault()
    onChange(def)
    saveVisible(def)
  }

  function handleSelectAll() {
    const all = ALL_COLS.map((c) => c.key)
    onChange(all)
    saveVisible(all)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          open
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-border/60 text-muted-foreground hover:text-foreground",
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        컬럼 설정
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {visible.length}/{ALL_COLS.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-border/70 bg-card shadow-2xl">
          <div className="border-b border-border/50 px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">표시할 컬럼 선택</p>
          </div>

          <ul className="py-1.5">
            {ALL_COLS.map(({ key, label }) => {
              const checked = visible.includes(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-accent/60"
                  >
                    <span className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-transparent",
                    )}>
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-border/50 px-3 py-2.5 flex flex-col gap-2">
            {/* 현재 설정을 기본값으로 저장 */}
            <button
              type="button"
              onClick={handleSaveDefault}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors",
                saved
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              {saved ? <><Check className="h-3 w-3" />저장 완료!</> : "현재 설정을 기본값으로 저장"}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex-1 text-[11px] text-primary hover:underline"
              >
                전체 선택
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                type="button"
                onClick={handleResetDefault}
                className="flex-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                기본값으로 리셋
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 메인 컴포넌트 ──────────────────────────────────────── */
export function AssetsView() {
  const { toast } = useToast()
  const [assets,  setAssets]  = useState<Asset[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState("")
  const [cat,     setCat]     = useState<(typeof CATEGORIES)[number]>("전체")
  const [status,  setStatus]  = useState<(typeof STATUS_FILTERS)[number]>("전체")
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [visible, setVisible] = useState<ColKey[]>(() => {
    if (typeof window === "undefined") return FACTORY_VISIBLE
    return loadVisible()
  })
  const [selected, setSelected] = useState<AssetDetail | null>(null)

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

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(col); setSortDir("asc") }
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Boxes}
        title="자산 목록"
        description="등록된 SW 자산의 제품명, 벤더, 버전, 담당자, EOS, 취약점, 패치 상태를 통합 관리합니다."
      />

      {/* 검색 + 필터 */}
      <div className="glow-card animate-rise flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제품명, 벤더, 버전, 담당자, 서버명 검색"
            className="w-full rounded-xl border border-border/60 bg-background/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                cat === c ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
              )}>
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
          <span className="text-xs font-medium text-muted-foreground">상태</span>
          {STATUS_FILTERS.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                status === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className="animate-rise">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-mono font-semibold text-foreground">{filtered.length}</span>건
            {loading && <span className="ml-2 text-xs">불러오는 중…</span>}
          </p>
          <ColToggle visible={visible} onChange={setVisible} />
        </div>

        <TableShell>
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
              <Th>작업</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const sv = servers.find((s) => s.name === a.server)
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
                  {show("id")       && <Td className="font-mono text-xs text-muted-foreground">{a.id}</Td>}
                  {show("name")     && <Td className="font-semibold">{a.name}</Td>}
                  {show("vendor")   && <Td className="text-muted-foreground">{a.vendor}</Td>}
                  {show("category") && <Td><StatusBadge accent="primary">{a.category}</StatusBadge></Td>}
                  {show("version")  && <Td className="font-mono text-xs">{a.version}</Td>}
                  {show("server")   && (
                    <Td>
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
                  {show("owner")    && <Td>{a.owner}</Td>}
                  {show("vuln")     && (
                    <Td>
                      <StatusBadge risk={vulnRisk[a.vuln]} pulse={a.vuln === "Critical"}>
                        {vulnLabel[a.vuln]}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("patch")    && (
                    <Td>
                      <StatusBadge risk={patchRisk[a.patch]}>{patchLabel[a.patch]}</StatusBadge>
                    </Td>
                  )}
                  {show("eos")      && (
                    <Td className={cn(
                      "font-mono text-xs",
                      isEosExpired(a.eos) ? "text-destructive font-semibold" : isEosSoon(a.eos) ? "text-eos" : "",
                    )}>
                      {a.eos ?? "-"}
                      {isEosExpired(a.eos) && <span className="ml-1 text-[10px]">[만료]</span>}
                    </Td>
                  )}
                  {show("approval") && (
                    <Td>
                      <StatusBadge risk={approvalRisk[a.approval]} pulse={a.approval === "긴급"}>
                        {a.approval}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("checked_at") && (
                    <Td className="text-xs text-muted-foreground">{formatChecked(a.checked_at)}</Td>
                  )}
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <MiniButton accent="primary" onClick={() => setSelected(toDetail(a))}>
                        <Eye className="h-3 w-3" />상세
                      </MiniButton>
                      <MiniButton accent="muted"><Pencil className="h-3 w-3" />수정</MiniButton>
                      <MiniButton accent="success" onClick={() => toast({
                        tone: "info",
                        title: "자산 정보 수집 시작",
                        description: `${a.name} (${a.server}) 최신 버전/패치 상태를 수집합니다.`,
                      })}>
                        <RefreshCw className="h-3 w-3" />수집
                      </MiniButton>
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
      </div>

      <AssetSlideover asset={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
