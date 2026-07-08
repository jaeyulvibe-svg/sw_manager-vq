"use client"

import { useEffect, useState } from "react"
import {
  Settings,
  Database,
  Link2,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  ScrollText,
  Play,
  Zap,
  Lock,
  Minus,
  Plus,
  Type,
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
  type Accent,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"
import { cn } from "@/lib/utils"

/* ---- Shared input style for inline add/edit forms ---- */
const inputCls =
  "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

function nextId(prefix: string, rows: { id: string }[]) {
  const nums = rows.map((r) => Number(r.id.split("-")[1]) || 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}-${String(next).padStart(3, "0")}`
}

/* ---- Section 1: SW master ---- */
type Master = {
  id: string
  name: string
  vendor: string
  cat: string
  std: string
  mode: string
  active: boolean
  updated: string
}

// 자산 목록(supabase/migrations/002_seed_data.sql의 assets)에 등록된 8개 제품과 동일하게 유지
// — SW 마스터 관리에 있는 솔루션만 자산 목록에 존재한다는 원칙
const MASTER_CATEGORIES = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]
const COLLECT_MODES = ["AUTO", "SEMI_AUTO", "MANUAL"]

const initialMasters: Master[] = [
  { id: "M-001", name: "Apache Tomcat", vendor: "Apache", cat: "WAS", std: "10.1.24", mode: "AUTO", active: true, updated: "오늘" },
  { id: "M-002", name: "JEUS", vendor: "TmaxSoft", cat: "WAS", std: "8.5", mode: "MANUAL", active: true, updated: "2026-06-20" },
  { id: "M-003", name: "WebtoB", vendor: "TmaxSoft", cat: "WEB", std: "6.0", mode: "SEMI_AUTO", active: true, updated: "어제" },
  { id: "M-004", name: "Oracle Database", vendor: "Oracle", cat: "DB", std: "23c", mode: "SEMI_AUTO", active: true, updated: "어제" },
  { id: "M-005", name: "OpenSSL", vendor: "OpenSSL Project", cat: "Security", std: "3.3.1", mode: "AUTO", active: true, updated: "오늘" },
  { id: "M-006", name: "Nginx", vendor: "F5", cat: "WEB", std: "1.27", mode: "AUTO", active: true, updated: "오늘" },
  { id: "M-007", name: "Red Hat Enterprise Linux", vendor: "Red Hat", cat: "OS", std: "9.4", mode: "SEMI_AUTO", active: true, updated: "어제" },
  { id: "M-008", name: "PostgreSQL", vendor: "PostgreSQL GDG", cat: "DB", std: "16.3", mode: "AUTO", active: true, updated: "오늘" },
]

/* ---- Section 2: Source URL — SW 마스터 관리의 8개 제품을 기준으로 시딩 ---- */
type Source = {
  id: string
  name: string
  type: string
  url: string
  cycle: string
  last: string
  status: string
}

const SOURCE_CYCLES = ["1시간", "6시간", "일 1회"]
const SOURCE_STATUSES = ["정상", "지연", "실패"]

const SOURCE_SEED_META: Record<
  string,
  { type: string; url: string; cycle: string; status?: string; last?: string }
> = {
  "Apache Tomcat": { type: "Vendor Security Advisory", url: "tomcat.apache.org/security-10.html", cycle: "6시간", last: "오늘 10:15" },
  "JEUS": { type: "Vendor Technical Notice", url: "tmaxsoft.com/kr/developer/notice/list", cycle: "일 1회", last: "어제 16:00" },
  "WebtoB": { type: "Vendor Technical Notice", url: "tmaxsoft.com/kr/developer/notice/list", cycle: "일 1회", last: "2일 전" },
  "Oracle Database": { type: "Lifecycle Page", url: "oracle.com/security-alerts", cycle: "일 1회", last: "어제 17:40" },
  "OpenSSL": { type: "Vendor Security Advisory", url: "openssl.org/news/vulnerabilities", cycle: "1시간", last: "오늘 09:30" },
  "Nginx": { type: "Vendor Security Advisory", url: "nginx.org/en/security_advisories.html", cycle: "6시간", last: "오늘 08:50" },
  "Red Hat Enterprise Linux": { type: "Vendor Security Advisory", url: "access.redhat.com/security/security-updates", cycle: "6시간", status: "실패", last: "3일 전" },
  "PostgreSQL": { type: "Vendor Security Advisory", url: "postgresql.org/support/security", cycle: "일 1회", last: "오늘 07:20" },
}

const initialSources: Source[] = initialMasters.map((m, i) => ({
  id: `S-${String(i + 1).padStart(3, "0")}`,
  name: m.name,
  type: SOURCE_SEED_META[m.name]?.type ?? "Vendor Security Advisory",
  url: SOURCE_SEED_META[m.name]?.url ?? "-",
  cycle: SOURCE_SEED_META[m.name]?.cycle ?? "일 1회",
  last: SOURCE_SEED_META[m.name]?.last ?? "-",
  status: SOURCE_SEED_META[m.name]?.status ?? "정상",
}))

const sourceStatusAccent: Record<string, Accent> = {
  정상: "success", 지연: "warning", 실패: "destructive",
}

/* ---- Inline add/edit form for SW 마스터 관리 ---- */
type MasterFormValues = Omit<Master, "id" | "updated">

function MasterFormPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: MasterFormValues
  onCancel: () => void
  onSubmit: (values: MasterFormValues) => void
}) {
  const [values, setValues] = useState<MasterFormValues>(
    initial ?? {
      name: "",
      vendor: "",
      cat: MASTER_CATEGORIES[0],
      std: "",
      mode: COLLECT_MODES[0],
      active: true,
    },
  )

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
          value={values.cat}
          onChange={(e) => setValues((v) => ({ ...v, cat: e.target.value }))}
          className={inputCls}
        >
          {MASTER_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">표준 버전</span>
        <input
          value={values.std}
          onChange={(e) => setValues((v) => ({ ...v, std: e.target.value }))}
          placeholder="예: 10.1.24"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">수집 모드</span>
        <select
          value={values.mode}
          onChange={(e) => setValues((v) => ({ ...v, mode: e.target.value }))}
          className={inputCls}
        >
          {COLLECT_MODES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))}
          className="h-4 w-4 rounded border-border/60 accent-primary"
        />
        <span className="font-medium text-muted-foreground">사용 여부</span>
      </label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={() => values.name.trim() && onSubmit(values)}
          disabled={!values.name.trim()}
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

/* ---- Inline add/edit form for 공식 Source URL 관리 ---- */
type SourceFormValues = Omit<Source, "id" | "last">

function SourceFormPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: SourceFormValues
  onCancel: () => void
  onSubmit: (values: SourceFormValues) => void
}) {
  const [values, setValues] = useState<SourceFormValues>(
    initial ?? {
      name: "",
      type: "Vendor Security Advisory",
      url: "",
      cycle: SOURCE_CYCLES[0],
      status: "정상",
    },
  )

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">제품명</span>
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="예: OpenSSL"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">Source 유형</span>
        <input
          value={values.type}
          onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
          placeholder="예: Vendor Security Advisory"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
        <span className="font-medium text-muted-foreground">공식 URL</span>
        <input
          value={values.url}
          onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
          placeholder="예: openssl.org/news/vulnerabilities"
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">수집 주기</span>
        <select
          value={values.cycle}
          onChange={(e) => setValues((v) => ({ ...v, cycle: e.target.value }))}
          className={inputCls}
        >
          {SOURCE_CYCLES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        <select
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
          className={inputCls}
        >
          {SOURCE_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={() => values.name.trim() && values.url.trim() && onSubmit(values)}
          disabled={!values.name.trim() || !values.url.trim()}
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

/* ---- Section 5: users ---- */
const users = [
  { name: "김관리", email: "admin@corp.com", dept: "정보보안팀", role: "관리자", assets: 0, active: true },
  { name: "정재율", email: "jy.jung@corp.com", dept: "인프라팀", role: "승인자", assets: 24, active: true },
  { name: "홍길동", email: "gd.hong@corp.com", dept: "WAS운영팀", role: "담당자", assets: 18, active: true },
  { name: "이영희", email: "yh.lee@corp.com", dept: "WEB운영팀", role: "조회 사용자", assets: 12, active: false },
]

const roleAccent: Record<string, Accent> = {
  관리자: "destructive", 승인자: "eos", 담당자: "primary", "조회 사용자": "muted",
}

/* ---- Section 6: logs ---- */
const logs = [
  { time: "10:32:04", type: "수집", target: "OpenSSL Advisory", result: "성공", who: "스케줄러" },
  { time: "10:15:22", type: "승인", target: "REQ-2026-002", result: "성공", who: "정재율" },
  { time: "09:58:11", type: "수집", target: "Nginx Release Notes", result: "실패", who: "스케줄러" },
  { time: "09:30:47", type: "매핑", target: "CVE-2026-0001", result: "성공", who: "김관리" },
]

const resultAccent: Record<string, Accent> = { 성공: "success", 실패: "destructive" }

/* ---- Font size control (admin page only) ---- */
const FONT_SCALE_MIN = 80
const FONT_SCALE_MAX = 150
const FONT_SCALE_STEP = 10
const FONT_SCALE_DEFAULT = 100
const FONT_SCALE_STORAGE_KEY = "admin-font-scale"

function FontSizeControl({
  scale,
  onChange,
}: {
  scale: number
  onChange: (next: number) => void
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border/70 bg-card p-1"
      role="group"
      aria-label="글자 크기 조절"
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(FONT_SCALE_MIN, scale - FONT_SCALE_STEP))}
        disabled={scale <= FONT_SCALE_MIN}
        aria-label="글자 크기 줄이기"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="flex items-center gap-1 px-1.5 text-xs font-semibold tabular-nums text-foreground">
        <Type className="h-3.5 w-3.5 text-muted-foreground" />
        {scale}%
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(FONT_SCALE_MAX, scale + FONT_SCALE_STEP))}
        disabled={scale >= FONT_SCALE_MAX}
        aria-label="글자 크기 키우기"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {scale !== FONT_SCALE_DEFAULT ? (
        <button
          type="button"
          onClick={() => onChange(FONT_SCALE_DEFAULT)}
          className="ml-0.5 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          초기화
        </button>
      ) : null}
    </div>
  )
}

function Toggle({
  label,
  desc,
  defaultOn = false,
}: {
  label: string
  desc: string
  defaultOn?: boolean
}) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform",
            on ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

type CollectLogEntry = { product: string; ok: boolean; newCount: number; error?: string }

const REAL_COLLECT_PRODUCTS = ["Apache Tomcat", "JEUS", "WebtoB"] as const

export function AdminView() {
  const [collecting, setCollecting] = useState(false)
  const [collectLog, setCollectLog] = useState<CollectLogEntry[]>([])
  const [fontScale, setFontScale] = useState(FONT_SCALE_DEFAULT)
  const { isAdmin } = useRole()
  const { toast } = useToast()

  const [masters, setMasters] = useState<Master[]>(initialMasters)
  const [masterPanel, setMasterPanel] = useState<"add" | string | null>(null)
  const [masterSelectMode, setMasterSelectMode] = useState(false)
  const [selectedMasterIds, setSelectedMasterIds] = useState<Set<string>>(new Set())

  const [sources, setSources] = useState<Source[]>(initialSources)
  const [sourcePanel, setSourcePanel] = useState<"add" | string | null>(null)
  const [sourceSelectMode, setSourceSelectMode] = useState(false)
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(FONT_SCALE_STORAGE_KEY))
    if (stored >= FONT_SCALE_MIN && stored <= FONT_SCALE_MAX) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFontScale(stored)
    }
  }, [])

  const updateFontScale = (next: number) => {
    setFontScale(next)
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next))
  }

  function saveMaster(values: MasterFormValues) {
    if (masterPanel === "add") {
      setMasters((prev) => [...prev, { id: nextId("M", prev), updated: "오늘", ...values }])
      toast({ title: "SW 마스터가 추가되었습니다", tone: "success" })
    } else if (masterPanel) {
      const id = masterPanel
      setMasters((prev) => prev.map((m) => (m.id === id ? { ...m, ...values, updated: "오늘" } : m)))
      toast({ title: "SW 마스터가 수정되었습니다", tone: "success" })
    }
    setMasterPanel(null)
  }

  function deleteMaster(target: Master) {
    if (!window.confirm(`"${target.name}"을(를) 삭제하시겠습니까?`)) return
    setMasters((prev) => prev.filter((m) => m.id !== target.id))
    toast({ title: "SW 마스터가 삭제되었습니다", tone: "info" })
  }

  function toggleMasterSelectAll() {
    setSelectedMasterIds((prev) =>
      prev.size === masters.length ? new Set() : new Set(masters.map((m) => m.id)),
    )
  }

  function toggleMasterSelected(id: string) {
    setSelectedMasterIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function cancelMasterSelection() {
    setMasterSelectMode(false)
    setSelectedMasterIds(new Set())
  }

  function saveMasterSelection() {
    if (selectedMasterIds.size === 0) {
      cancelMasterSelection()
      return
    }
    if (!window.confirm(`선택한 SW 마스터 ${selectedMasterIds.size}건을 삭제하시겠습니까?`)) return
    setMasters((prev) => prev.filter((m) => !selectedMasterIds.has(m.id)))
    toast({ title: `SW 마스터 ${selectedMasterIds.size}건이 삭제되었습니다`, tone: "info" })
    cancelMasterSelection()
  }

  function saveSource(values: SourceFormValues) {
    if (sourcePanel === "add") {
      setSources((prev) => [...prev, { id: nextId("S", prev), last: "-", ...values }])
      toast({ title: "Source URL이 추가되었습니다", tone: "success" })
    } else if (sourcePanel) {
      const id = sourcePanel
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...values } : s)))
      toast({ title: "Source URL이 수정되었습니다", tone: "success" })
    }
    setSourcePanel(null)
  }

  function deleteSource(target: Source) {
    if (!window.confirm(`"${target.name}" Source URL을 삭제하시겠습니까?`)) return
    setSources((prev) => prev.filter((s) => s.id !== target.id))
    toast({ title: "Source URL이 삭제되었습니다", tone: "info" })
  }

  function toggleSourceSelectAll() {
    setSelectedSourceIds((prev) =>
      prev.size === sources.length ? new Set() : new Set(sources.map((s) => s.id)),
    )
  }

  function toggleSourceSelected(id: string) {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function cancelSourceSelection() {
    setSourceSelectMode(false)
    setSelectedSourceIds(new Set())
  }

  function saveSourceSelection() {
    if (selectedSourceIds.size === 0) {
      cancelSourceSelection()
      return
    }
    if (!window.confirm(`선택한 Source URL ${selectedSourceIds.size}건을 삭제하시겠습니까?`)) return
    setSources((prev) => prev.filter((s) => !selectedSourceIds.has(s.id)))
    toast({ title: `Source URL ${selectedSourceIds.size}건이 삭제되었습니다`, tone: "info" })
    cancelSourceSelection()
  }

  async function runCollection() {
    setCollecting(true)
    try {
      const res = await fetch("/api/collect-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: REAL_COLLECT_PRODUCTS }),
      })
      const data = await res.json()
      const results: CollectLogEntry[] = data.results ?? []
      setCollectLog(results)

      const nowLabel = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      setSources((prev) =>
        prev.map((s) => {
          const r = results.find((x) => x.product === s.name)
          if (!r) return s
          return { ...s, last: `오늘 ${nowLabel}`, status: r.ok ? "정상" : "실패" }
        }),
      )

      const totalNew = results.reduce((sum, r) => sum + r.newCount, 0)
      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        toast({
          title: `자동수집 일부 실패: ${failed.map((f) => f.product).join(", ")}`,
          tone: "danger",
        })
      } else if (totalNew > 0) {
        toast({ title: `자동수집 완료: 신규 항목 ${totalNew}건 발견`, tone: "success" })
      } else {
        toast({ title: "자동수집 완료: 신규 항목 없음", tone: "success" })
      }
    } catch (err) {
      toast({ title: "자동수집 중 오류가 발생했습니다", tone: "danger" })
      setCollectLog(
        REAL_COLLECT_PRODUCTS.map((p) => ({
          product: p,
          ok: false,
          newCount: 0,
          error: err instanceof Error ? err.message : String(err),
        })),
      )
    } finally {
      setCollecting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={Settings}
          title="관리자 페이지"
          description="관리자는 SW 마스터 데이터, Source URL, 자동수집 정책, 승인 프로세스, 사용자 권한을 통합 관리합니다."
        />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card px-6 py-16 text-center glow-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-eos/15 text-eos">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">접근 권한이 없습니다</h3>
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">
            이 페이지는 <span className="font-semibold text-primary">관리자 모드</span>에서만
            이용할 수 있습니다. 상단의 모드 전환 스위치를 사용해 관리자 모드로 변경하세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Settings}
        title="관리자 페이지"
        description="관리자는 SW 마스터 데이터, Source URL, 자동수집 정책, 승인 프로세스, 사용자 권한을 통합 관리합니다."
        action={<FontSizeControl scale={fontScale} onChange={updateFontScale} />}
      />

      <div
        className="flex min-w-0 flex-col gap-6"
        style={{ zoom: String(fontScale / 100) }}
      >
      {/* Section 1: SW master */}
      <SectionCard
        title="SW 마스터 관리"
        subtitle="표준 소프트웨어 마스터 데이터"
        icon={Database}
        action={
          masterPanel ? null : masterSelectMode ? (
            <div className="flex items-center gap-1.5">
              <MiniButton accent="success" onClick={saveMasterSelection}>
                <Check className="h-3.5 w-3.5" />
                저장
              </MiniButton>
              <MiniButton onClick={cancelMasterSelection}>
                <X className="h-3.5 w-3.5" />
                취소
              </MiniButton>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <MiniButton accent="primary" onClick={() => setMasterPanel("add")}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </MiniButton>
              <MiniButton accent="destructive" onClick={() => setMasterSelectMode(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </MiniButton>
            </div>
          )
        }
      >
        {masterPanel === "add" ? (
          <MasterFormPanel onCancel={() => setMasterPanel(null)} onSubmit={saveMaster} />
        ) : null}
        <TableShell>
          <thead>
            <tr>
              {masterSelectMode ? (
                <Th className="w-8">
                  <input
                    type="checkbox"
                    checked={masters.length > 0 && selectedMasterIds.size === masters.length}
                    onChange={toggleMasterSelectAll}
                    aria-label="전체 선택"
                    className="h-4 w-4 rounded border-border/60 accent-primary"
                  />
                </Th>
              ) : null}
              <Th>마스터 ID</Th><Th>제품명</Th><Th>벤더</Th><Th>분류</Th>
              <Th>표준 버전</Th><Th>수집 모드</Th><Th>사용 여부</Th><Th>최근 갱신일</Th>
              {masterSelectMode ? null : <Th>관리</Th>}
            </tr>
          </thead>
          <tbody>
            {masters.map((m) =>
              masterPanel === m.id ? (
                <tr key={m.id}>
                  <td colSpan={9} className="border-b border-border/40 p-0">
                    <MasterFormPanel
                      initial={{
                        name: m.name,
                        vendor: m.vendor,
                        cat: m.cat,
                        std: m.std,
                        mode: m.mode,
                        active: m.active,
                      }}
                      onCancel={() => setMasterPanel(null)}
                      onSubmit={saveMaster}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={m.id} className="transition-colors hover:bg-accent/40">
                  {masterSelectMode ? (
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedMasterIds.has(m.id)}
                        onChange={() => toggleMasterSelected(m.id)}
                        aria-label={`${m.name} 선택`}
                        className="h-4 w-4 rounded border-border/60 accent-primary"
                      />
                    </Td>
                  ) : null}
                  <Td className="font-mono text-xs text-muted-foreground">{m.id}</Td>
                  <Td className="font-semibold">{m.name}</Td>
                  <Td className="text-muted-foreground">{m.vendor}</Td>
                  <Td><StatusBadge accent="primary">{m.cat}</StatusBadge></Td>
                  <Td className="font-mono text-xs">{m.std}</Td>
                  <Td><StatusBadge accent="eos">{m.mode}</StatusBadge></Td>
                  <Td>
                    <StatusBadge accent={m.active ? "success" : "muted"}>
                      {m.active ? "사용" : "미사용"}
                    </StatusBadge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{m.updated}</Td>
                  {masterSelectMode ? null : (
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <MiniButton onClick={() => setMasterPanel(m.id)}>
                          <Pencil className="h-3 w-3" />
                          수정
                        </MiniButton>
                        <MiniButton accent="destructive" onClick={() => deleteMaster(m)}>
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </MiniButton>
                      </div>
                    </Td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </TableShell>
      </SectionCard>

      {/* Section 2: Source URL */}
      <SectionCard
        title="공식 Source URL 관리"
        subtitle="자동수집 대상 공식 출처"
        icon={Link2}
        action={
          sourcePanel ? null : sourceSelectMode ? (
            <div className="flex items-center gap-1.5">
              <MiniButton accent="success" onClick={saveSourceSelection}>
                <Check className="h-3.5 w-3.5" />
                저장
              </MiniButton>
              <MiniButton onClick={cancelSourceSelection}>
                <X className="h-3.5 w-3.5" />
                취소
              </MiniButton>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <MiniButton accent="primary" onClick={() => setSourcePanel("add")}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </MiniButton>
              <MiniButton accent="destructive" onClick={() => setSourceSelectMode(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </MiniButton>
            </div>
          )
        }
      >
        {sourcePanel === "add" ? (
          <SourceFormPanel onCancel={() => setSourcePanel(null)} onSubmit={saveSource} />
        ) : null}
        <TableShell>
          <thead>
            <tr>
              {sourceSelectMode ? (
                <Th className="w-8">
                  <input
                    type="checkbox"
                    checked={sources.length > 0 && selectedSourceIds.size === sources.length}
                    onChange={toggleSourceSelectAll}
                    aria-label="전체 선택"
                    className="h-4 w-4 rounded border-border/60 accent-primary"
                  />
                </Th>
              ) : null}
              <Th>제품명</Th><Th>Source 유형</Th><Th>공식 URL</Th>
              <Th>수집 주기</Th><Th>마지막 수집</Th><Th>상태</Th>
              {sourceSelectMode ? null : <Th>관리</Th>}
            </tr>
          </thead>
          <tbody>
            {sources.map((s) =>
              sourcePanel === s.id ? (
                <tr key={s.id}>
                  <td colSpan={7} className="border-b border-border/40 p-0">
                    <SourceFormPanel
                      initial={{
                        name: s.name,
                        type: s.type,
                        url: s.url,
                        cycle: s.cycle,
                        status: s.status,
                      }}
                      onCancel={() => setSourcePanel(null)}
                      onSubmit={saveSource}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className="transition-colors hover:bg-accent/40">
                  {sourceSelectMode ? (
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.has(s.id)}
                        onChange={() => toggleSourceSelected(s.id)}
                        aria-label={`${s.name} 선택`}
                        className="h-4 w-4 rounded border-border/60 accent-primary"
                      />
                    </Td>
                  ) : null}
                  <Td className="font-semibold">{s.name}</Td>
                  <Td className="text-muted-foreground">{s.type}</Td>
                  <Td className="font-mono text-xs text-primary">{s.url}</Td>
                  <Td className="text-xs">{s.cycle}</Td>
                  <Td className="text-xs text-muted-foreground">{s.last}</Td>
                  <Td>
                    <StatusBadge accent={sourceStatusAccent[s.status]} pulse={s.status === "실패"}>
                      {s.status}
                    </StatusBadge>
                  </Td>
                  {sourceSelectMode ? null : (
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <MiniButton onClick={() => setSourcePanel(s.id)}>
                          <Pencil className="h-3 w-3" />
                          수정
                        </MiniButton>
                        <MiniButton accent="destructive" onClick={() => deleteSource(s)}>
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </MiniButton>
                      </div>
                    </Td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </TableShell>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 3: Auto collect */}
        <SectionCard
          title="자동수집 설정"
          subtitle="스케줄러 및 수동 수집"
          icon={RefreshCw}
          action={
            <button
              type="button"
              onClick={runCollection}
              disabled={collecting}
              className="glow-card inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" />
              즉시 수집
            </button>
          }
        >
          <div className="flex flex-col gap-3">
            <Toggle label="자동 수집 스케줄러" desc="공식 Source 주기적 자동 수집" defaultOn />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">수집 주기</p>
                <p className="text-xs text-muted-foreground">기본 수집 인터벌</p>
              </div>
              <select className="shrink-0 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none">
                <option>1시간</option>
                <option>6시간</option>
                <option>일 1회</option>
              </select>
            </div>

            {/* Collection log with shimmer while collecting */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                수집 기동 내역
              </p>
              <ul className="flex flex-col gap-1.5 text-xs">
                {collecting ? (
                  <>
                    <li className="shimmer h-7 rounded-md bg-card" />
                    <li className="shimmer h-7 rounded-md bg-card" />
                    <li className="shimmer h-7 rounded-md bg-card" />
                  </>
                ) : collectLog.length === 0 ? (
                  <li className="rounded-md bg-card px-2 py-3 text-center text-muted-foreground">
                    아직 수집 내역이 없습니다. &quot;즉시 수집&quot;을 눌러 실행하세요.
                  </li>
                ) : (
                  collectLog.map((entry) => (
                    <li
                      key={entry.product}
                      className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        {entry.product}
                        {entry.ok && entry.newCount > 0 ? ` — 신규 ${entry.newCount}건` : ""}
                      </span>
                      <StatusBadge
                        accent={entry.ok ? "success" : "destructive"}
                        pulse={!entry.ok}
                        className="shrink-0"
                      >
                        {entry.ok ? "성공" : "실패"}
                      </StatusBadge>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* Section 4: Approval policy */}
        <SectionCard title="승인 정책 관리" subtitle="자동 알림 및 승인 규칙" icon={ShieldCheck}>
          <div className="flex flex-col gap-3">
            <Toggle label="Critical 자동 긴급 알림" desc="Critical 취약점 발견 시 즉시 알림" defaultOn />
            <Toggle label="High 이상 관리자 승인 필수" desc="High 등급 이상 패치는 관리자 승인" defaultOn />
            <Toggle label="EOS 180일 전 알림" desc="지원 종료 180일 전 담당자 알림" defaultOn />
            <Toggle label="패치 공지 수집 후 승인 대기 등록" desc="수집된 공지를 자동으로 승인 대기 큐에 등록" />
          </div>
        </SectionCard>
      </div>

      {/* Section 5: Users */}
      <SectionCard title="사용자 권한 관리" subtitle="관리자 · 승인자 · 담당자 · 조회 사용자" icon={UsersRound}>
        <TableShell>
          <thead>
            <tr>
              <Th>사용자명</Th><Th>이메일</Th><Th>부서</Th>
              <Th>권한</Th><Th>담당 자산 수</Th><Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="transition-colors hover:bg-accent/40">
                <Td className="font-semibold">{u.name}</Td>
                <Td className="font-mono text-xs text-muted-foreground">{u.email}</Td>
                <Td className="text-muted-foreground">{u.dept}</Td>
                <Td><StatusBadge accent={roleAccent[u.role]}>{u.role}</StatusBadge></Td>
                <Td className="font-mono">{u.assets}</Td>
                <Td>
                  <StatusBadge accent={u.active ? "success" : "muted"}>
                    {u.active ? "활성" : "비활성"}
                  </StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>

      {/* Section 6: Logs */}
      <SectionCard title="시스템 로그" subtitle="수집·승인·매핑 작업 이력" icon={ScrollText}>
        <TableShell>
          <thead>
            <tr>
              <Th>시간</Th><Th>작업 유형</Th><Th>대상</Th><Th>결과</Th><Th>수행자</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="transition-colors hover:bg-accent/40">
                <Td className="font-mono text-xs text-muted-foreground">{l.time}</Td>
                <Td><StatusBadge accent="primary">{l.type}</StatusBadge></Td>
                <Td className="font-mono text-xs">{l.target}</Td>
                <Td>
                  <StatusBadge accent={resultAccent[l.result]} pulse={l.result === "실패"}>
                    {l.result}
                  </StatusBadge>
                </Td>
                <Td className="text-muted-foreground">{l.who}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>
      </div>
    </div>
  )
}
