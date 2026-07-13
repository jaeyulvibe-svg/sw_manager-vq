"use client"

import { useEffect, useState } from "react"
import {
  Settings,
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
  FilePlus2,
  CalendarClock,
  Search,
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
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

/* ---- Shared input style for inline add/edit forms ---- */
const inputCls =
  "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

function nextId(prefix: string, rows: { id: string }[]) {
  const nums = rows.map((r) => Number(r.id.split("-")[1]) || 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}-${String(next).padStart(3, "0")}`
}

/* ---- Section: Source URL — SW 마스터 관리(별도 화면)의 8개 제품을 기준으로 시딩 ---- */
// 자산 목록(supabase/migrations/002_seed_data.sql의 assets)에 등록된 8개 제품과 동일하게 유지
// — SW 마스터 관리에 있는 솔루션만 자산 목록에 존재한다는 원칙
const SOURCE_PRODUCT_NAMES = [
  "Apache Tomcat",
  "JEUS",
  "WebtoB",
  "Oracle Database",
  "OpenSSL",
  "Nginx",
  "Red Hat Enterprise Linux",
  "PostgreSQL",
]
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

const initialSources: Source[] = SOURCE_PRODUCT_NAMES.map((name, i) => ({
  id: `S-${String(i + 1).padStart(3, "0")}`,
  name,
  type: SOURCE_SEED_META[name]?.type ?? "Vendor Security Advisory",
  url: SOURCE_SEED_META[name]?.url ?? "-",
  cycle: SOURCE_SEED_META[name]?.cycle ?? "일 1회",
  last: SOURCE_SEED_META[name]?.last ?? "-",
  status: SOURCE_SEED_META[name]?.status ?? "정상",
}))

const sourceStatusRisk: Record<string, RiskLevel> = {
  정상: 1, 지연: 3, 실패: 4,
}

type SourceColKey = "name" | "type" | "url" | "cycle" | "last" | "status"
const SOURCE_ALL_COLS: { key: SourceColKey; label: string }[] = [
  { key: "name", label: "제품명" },
  { key: "type", label: "Source 유형" },
  { key: "url", label: "공식 URL" },
  { key: "cycle", label: "수집 주기" },
  { key: "last", label: "마지막 수집" },
  { key: "status", label: "상태" },
]
const SOURCE_FACTORY_VISIBLE: SourceColKey[] = SOURCE_ALL_COLS.map((c) => c.key)
const SOURCE_LS_KEY = "admin_source_columns"

type SourceSortKey = SourceColKey | "none"
const sourceStatusOrder: Record<string, number> = { 실패: 0, 지연: 1, 정상: 2 }

function sourceSortValue(s: Source, key: SourceSortKey): string | number {
  if (key === "status") return sourceStatusOrder[s.status] ?? 99
  if (key === "none") return 0
  return s[key]
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

/* ---- Manual registration: 패치/취약점 수동 등록 ---- */
type VulnSeverity = Tables<"vulnerabilities">["severity"]
type NoticeType = Tables<"vulnerabilities">["notice_type"]
const MANUAL_VULN_SEVERITIES: VulnSeverity[] = ["Critical", "High", "Medium", "Low"]
const MANUAL_VULN_NOTICE_TYPES: NoticeType[] = ["CVE", "Patch", "EOS"]

type SourceType = Tables<"vulnerabilities">["source_type"]
const MANUAL_VULN_SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "kisa", label: "KISA" },
  { value: "vendor", label: "제조사" },
]

type ManualVulnFormValues = {
  cve: string
  title: string
  severity: VulnSeverity
  product: string
  source: string
  source_url: string
  source_type: SourceType
  notice_type: NoticeType
}

const EMPTY_MANUAL_VULN: ManualVulnFormValues = {
  cve: "",
  title: "",
  severity: "Medium",
  product: "",
  source: "",
  source_url: "",
  source_type: "vendor",
  notice_type: "CVE",
}

function ManualVulnFormPanel({
  onSubmit,
  submitting,
}: {
  onSubmit: (values: ManualVulnFormValues) => Promise<boolean>
  submitting: boolean
}) {
  const [values, setValues] = useState<ManualVulnFormValues>(EMPTY_MANUAL_VULN)
  const canSubmit =
    values.cve.trim() && values.title.trim() && values.product.trim() && values.source.trim()

  async function handleSubmit() {
    if (!canSubmit) return
    const ok = await onSubmit(values)
    if (ok) setValues(EMPTY_MANUAL_VULN)
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">CVE / 식별자</span>
        <input
          value={values.cve}
          onChange={(e) => setValues((v) => ({ ...v, cve: e.target.value }))}
          placeholder="예: CVE-2026-0001"
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2">
        <span className="font-medium text-muted-foreground">제목</span>
        <input
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          placeholder="예: OpenSSL 원격 코드 실행 취약점"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">심각도</span>
        <select
          value={values.severity}
          onChange={(e) => setValues((v) => ({ ...v, severity: e.target.value as VulnSeverity }))}
          className={inputCls}
        >
          {MANUAL_VULN_SEVERITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">공지 유형</span>
        <select
          value={values.notice_type}
          onChange={(e) => setValues((v) => ({ ...v, notice_type: e.target.value as NoticeType }))}
          className={inputCls}
        >
          {MANUAL_VULN_NOTICE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">제품명</span>
        <input
          value={values.product}
          onChange={(e) => setValues((v) => ({ ...v, product: e.target.value }))}
          placeholder="예: Apache Tomcat 10.1.x"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">출처</span>
        <input
          value={values.source}
          onChange={(e) => setValues((v) => ({ ...v, source: e.target.value }))}
          placeholder="예: KISA 보안공지"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">출처 유형</span>
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5">
          {MANUAL_VULN_SOURCE_TYPES.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-xs text-foreground">
              <input
                type="radio"
                name="manual-vuln-source-type"
                checked={values.source_type === opt.value}
                onChange={() => setValues((v) => ({ ...v, source_type: opt.value }))}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </label>
      <label className="flex flex-col gap-1 text-xs sm:col-span-2 lg:col-span-1">
        <span className="font-medium text-muted-foreground">출처 URL (선택)</span>
        <input
          value={values.source_url}
          onChange={(e) => setValues((v) => ({ ...v, source_url: e.target.value }))}
          placeholder="예: kisa.or.kr/notice/..."
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "등록 중..." : "승인대기로 등록"}
        </button>
      </div>
    </div>
  )
}

/* ---- Manual registration: 자산 EOS 수동 수정 ---- */
type ManualEosFormValues = { assetId: string; eos: string }

function ManualEosFormPanel({
  assets,
  onSubmit,
  submitting,
}: {
  assets: Tables<"assets">[]
  onSubmit: (values: ManualEosFormValues) => Promise<boolean>
  submitting: boolean
}) {
  const [assetId, setAssetId] = useState("")
  const [eos, setEos] = useState("")

  function handleSelectAsset(id: string) {
    setAssetId(id)
    setEos(assets.find((a) => a.id === id)?.eos ?? "")
  }

  async function handleSubmit() {
    if (!assetId || !eos) return
    const ok = await onSubmit({ assetId, eos })
    if (ok) {
      setAssetId("")
      setEos("")
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs sm:col-span-2">
        <span className="font-medium text-muted-foreground">자산 선택</span>
        <select
          value={assetId}
          onChange={(e) => handleSelectAsset(e.target.value)}
          className={inputCls}
        >
          <option value="">자산을 선택하세요</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.server} ({a.eos ?? "EOS 미등록"})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">EOS 날짜</span>
        <input
          type="date"
          value={eos}
          onChange={(e) => setEos(e.target.value)}
          className={inputCls}
        />
      </label>
      <div className="sm:col-span-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!assetId || !eos || submitting}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "저장 중..." : "EOS 반영"}
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

type UserColKey = "name" | "email" | "dept" | "role" | "assets" | "active"
const USER_ALL_COLS: { key: UserColKey; label: string }[] = [
  { key: "name", label: "사용자명" },
  { key: "email", label: "이메일" },
  { key: "dept", label: "부서" },
  { key: "role", label: "권한" },
  { key: "assets", label: "담당 자산 수" },
  { key: "active", label: "상태" },
]
const USER_FACTORY_VISIBLE: UserColKey[] = USER_ALL_COLS.map((c) => c.key)
const USER_LS_KEY = "admin_users_columns"

type UserSortKey = UserColKey | "none"
type UserRow = (typeof users)[number]

function userSortValue(u: UserRow, key: UserSortKey): string | number {
  if (key === "active") return u.active ? 1 : 0
  if (key === "assets") return u.assets
  if (key === "none") return 0
  return u[key]
}

/* ---- Section 6: logs ---- */
const logs = [
  { time: "10:32:04", type: "수집", target: "OpenSSL Advisory", result: "성공", who: "스케줄러" },
  { time: "10:15:22", type: "승인", target: "REQ-2026-002", result: "성공", who: "정재율" },
  { time: "09:58:11", type: "수집", target: "Nginx Release Notes", result: "실패", who: "스케줄러" },
  { time: "09:30:47", type: "매핑", target: "CVE-2026-0001", result: "성공", who: "김관리" },
]

const resultRisk: Record<string, RiskLevel> = { 성공: 1, 실패: 4 }

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
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-[left]",
            on ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  )
}

type CollectLogEntry = { product: string; ok: boolean; newCount: number; error?: string }

const REAL_COLLECT_PRODUCTS = [
  "Apache Tomcat", "JEUS", "WebtoB",
  "Nginx", "PostgreSQL", "OpenSSL", "Red Hat Enterprise Linux", "Oracle Database",
  "KISA",
] as const

/* ---- Admin page tabs — navigated via the sidebar's "관리자 페이지" submenu ---- */
export type AdminTab = "collect" | "policy" | "users"

export function AdminView({ initialTab }: { initialTab: AdminTab }) {
  const activeTab = initialTab
  const [collecting, setCollecting] = useState(false)
  const [collectLog, setCollectLog] = useState<CollectLogEntry[]>([])
  const [fontScale, setFontScale] = useState(FONT_SCALE_DEFAULT)
  const { isAdmin } = useRole()
  const { toast } = useToast()

  const [sources, setSources] = useState<Source[]>(initialSources)
  const [sourcePanel, setSourcePanel] = useState<"add" | string | null>(null)
  const [sourceSelectMode, setSourceSelectMode] = useState(false)
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
  const [sourceQuery, setSourceQuery] = useState("")
  const [sourceSortKey, setSourceSortKey] = useState<SourceSortKey>("name")
  const [sourceSortDir, setSourceSortDir] = useState<"asc" | "desc">("asc")
  const [sourceVisible, setSourceVisible] = useState<SourceColKey[]>(() =>
    loadColumnVisibility(SOURCE_LS_KEY, SOURCE_FACTORY_VISIBLE),
  )

  function handleSourceSort(col: SourceSortKey) {
    if (sourceSortKey === col) setSourceSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSourceSortKey(col)
      setSourceSortDir("asc")
    }
  }

  const filteredSources = sources
    .filter((s) => {
      const q = sourceQuery.trim().toLowerCase()
      return !q || [s.name, s.url].some((f) => f.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const va = sourceSortValue(a, sourceSortKey)
      const vb = sourceSortValue(b, sourceSortKey)
      const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
      return sourceSortDir === "asc" ? d : -d
    })

  const showSourceCol = (key: SourceColKey) => sourceVisible.includes(key)

  const [userQuery, setUserQuery] = useState("")
  const [userSortKey, setUserSortKey] = useState<UserSortKey>("name")
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc")
  const [userVisible, setUserVisible] = useState<UserColKey[]>(() =>
    loadColumnVisibility(USER_LS_KEY, USER_FACTORY_VISIBLE),
  )

  function handleUserSort(col: UserSortKey) {
    if (userSortKey === col) setUserSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setUserSortKey(col)
      setUserSortDir("asc")
    }
  }

  const filteredUsers = users
    .filter((u) => {
      const q = userQuery.trim().toLowerCase()
      return !q || [u.name, u.email, u.dept].some((f) => f.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const va = userSortValue(a, userSortKey)
      const vb = userSortValue(b, userSortKey)
      const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
      return userSortDir === "asc" ? d : -d
    })

  const showUserCol = (key: UserColKey) => userVisible.includes(key)

  const [assets, setAssets] = useState<Tables<"assets">[]>([])
  const [manualVulnSubmitting, setManualVulnSubmitting] = useState(false)
  const [manualEosSubmitting, setManualEosSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("assets")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setAssets(data)
      })
  }, [])

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(FONT_SCALE_STORAGE_KEY))
    if (stored >= FONT_SCALE_MIN && stored <= FONT_SCALE_MAX) {
      setFontScale(stored)
    }
  }, [])

  const updateFontScale = (next: number) => {
    setFontScale(next)
    window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next))
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
      prev.size === filteredSources.length ? new Set() : new Set(filteredSources.map((s) => s.id)),
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

  async function submitManualVuln(values: ManualVulnFormValues): Promise<boolean> {
    setManualVulnSubmitting(true)
    const supabase = createClient()
    const payload: TablesInsert<"vulnerabilities"> = {
      cve: values.cve.trim(),
      title: values.title.trim(),
      severity: values.severity,
      product: values.product.trim(),
      source: values.source.trim(),
      source_url: values.source_url.trim() || null,
      source_type: values.source_type,
      notice_type: values.notice_type,
      approval: "승인대기",
    }
    const { error } = await supabase.from("vulnerabilities").insert(payload)
    setManualVulnSubmitting(false)
    if (error) {
      toast({ title: "등록 실패", description: error.message, tone: "danger" })
      return false
    }
    toast({
      title: "취약점/패치 공지가 등록되었습니다",
      description:
        values.notice_type === "EOS"
          ? "EOS 공지 화면에서 검토·승인해주세요."
          : values.source_type === "kisa"
            ? "KISA 취약점 공지 화면에서 검토·승인해주세요."
            : "제조사 취약점 공지 화면에서 검토·승인해주세요.",
      tone: "success",
    })
    return true
  }

  async function submitManualEos(values: ManualEosFormValues): Promise<boolean> {
    setManualEosSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("assets")
      .update({ eos: values.eos })
      .eq("id", values.assetId)
    setManualEosSubmitting(false)
    if (error) {
      toast({ title: "EOS 수정 실패", description: error.message, tone: "danger" })
      return false
    }
    setAssets((prev) =>
      prev.map((a) => (a.id === values.assetId ? { ...a, eos: values.eos } : a)),
    )
    toast({ title: "자산 EOS가 반영되었습니다", tone: "success" })
    return true
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
      {activeTab === "collect" && (
      <>
      {/* Section: Source URL */}
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
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="제품명, URL 검색"
                  className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <ExportExcelButton
                rows={filteredSources}
                filename="공식_Source_URL_관리"
                columns={[
                  { label: "제품명", value: (s: Source) => s.name },
                  { label: "Source 유형", value: (s: Source) => s.type },
                  { label: "공식 URL", value: (s: Source) => s.url },
                  { label: "수집 주기", value: (s: Source) => s.cycle },
                  { label: "마지막 수집", value: (s: Source) => s.last },
                  { label: "상태", value: (s: Source) => s.status },
                ]}
              />
              <ColumnVisibilityMenu
                allCols={SOURCE_ALL_COLS}
                visible={sourceVisible}
                onChange={setSourceVisible}
                factoryDefault={SOURCE_FACTORY_VISIBLE}
                storageKey={SOURCE_LS_KEY}
              />
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
        <TableShell scrollHint>
          <thead>
            <tr>
              {sourceSelectMode ? (
                <Th className={cn("w-8", TABLE_HEADER_CELL_H)}>
                  <input
                    type="checkbox"
                    checked={filteredSources.length > 0 && selectedSourceIds.size === filteredSources.length}
                    onChange={toggleSourceSelectAll}
                    aria-label="전체 선택"
                    className="h-4 w-4 rounded border-border/60 accent-primary"
                  />
                </Th>
              ) : null}
              {showSourceCol("name") && <SortTh col="name" label="제품명" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("type") && <SortTh col="type" label="Source 유형" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("url") && <SortTh col="url" label="공식 URL" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("cycle") && <SortTh col="cycle" label="수집 주기" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("last") && <SortTh col="last" label="마지막 수집" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("status") && <SortTh col="status" label="상태" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {sourceSelectMode ? null : <Th className={TABLE_HEADER_CELL_H}>관리</Th>}
            </tr>
          </thead>
          <tbody>
            {filteredSources.map((s) =>
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
                    <Td className={TABLE_ROW_CELL_H}>
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.has(s.id)}
                        onChange={() => toggleSourceSelected(s.id)}
                        aria-label={`${s.name} 선택`}
                        className="h-4 w-4 rounded border-border/60 accent-primary"
                      />
                    </Td>
                  ) : null}
                  {showSourceCol("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{s.name}</Td>}
                  {showSourceCol("type") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{s.type}</Td>}
                  {showSourceCol("url") && <Td className={cn("font-mono text-xs text-primary", TABLE_ROW_CELL_H)}>{s.url}</Td>}
                  {showSourceCol("cycle") && <Td className={cn("text-xs", TABLE_ROW_CELL_H)}>{s.cycle}</Td>}
                  {showSourceCol("last") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{s.last}</Td>}
                  {showSourceCol("status") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={sourceStatusRisk[s.status]} pulse={s.status === "실패"}>
                        {s.status}
                      </StatusBadge>
                    </Td>
                  )}
                  {sourceSelectMode ? null : (
                    <Td className={TABLE_ROW_CELL_H}>
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

      <div className="grid grid-cols-1 gap-6">
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
                      className="flex flex-col gap-1 rounded-md bg-card px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
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
                      </div>
                      {!entry.ok && entry.error && (
                        <p className="truncate text-destructive/80" title={entry.error}>
                          {entry.error}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </SectionCard>

      </div>

      {/* Section: Manual registration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="패치/취약점 수동 등록"
          subtitle="자동수집 대상이 아닌 공지를 직접 등록"
          icon={FilePlus2}
        >
          <ManualVulnFormPanel onSubmit={submitManualVuln} submitting={manualVulnSubmitting} />
          <p className="mt-3 text-[11px] text-muted-foreground">
            등록된 공지는 &apos;승인대기&apos; 상태로 공지 유형에 맞는 화면(EOS는 &apos;EOS 공지&apos;, 그 외는 출처 유형에 따라 &apos;KISA 취약점 공지&apos; 또는 &apos;제조사 취약점 공지&apos;)에 나타납니다. 그곳에서 검토 후 승인하면 승인된 취약점 공지에 반영됩니다.
          </p>
        </SectionCard>

        <SectionCard
          title="자산 EOS 수동 수정"
          subtitle="보유 자산의 지원종료일을 직접 입력"
          icon={CalendarClock}
        >
          <ManualEosFormPanel assets={assets} onSubmit={submitManualEos} submitting={manualEosSubmitting} />
          <p className="mt-3 text-[11px] text-muted-foreground">
            승인 절차 없이 즉시 반영되며, EOS 로드맵과 자산 목록에 바로 나타납니다.
          </p>
        </SectionCard>
      </div>
      </>
      )}

      {activeTab === "policy" && (
      <SectionCard title="승인 정책 관리" subtitle="자동 알림 및 승인 규칙" icon={ShieldCheck}>
        <div className="flex flex-col gap-3">
          <Toggle label="Critical 자동 긴급 알림" desc="Critical 취약점 발견 시 즉시 알림" defaultOn />
          <Toggle label="High 이상 관리자 승인 필수" desc="High 등급 이상 패치는 관리자 승인" defaultOn />
          <Toggle label="EOS 180일 전 알림" desc="지원 종료 180일 전 담당자 알림" defaultOn />
          <Toggle label="패치 공지 수집 후 승인 대기 등록" desc="수집된 공지를 자동으로 승인 대기 큐에 등록" />
        </div>
      </SectionCard>
      )}

      {activeTab === "users" && (
      <>
      {/* Section 5: Users */}
      <SectionCard
        title="사용자 권한 관리"
        subtitle="관리자 · 승인자 · 담당자 · 조회 사용자"
        icon={UsersRound}
        action={
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="이름, 이메일, 부서 검색"
                className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>
            <ExportExcelButton
              rows={filteredUsers}
              filename="사용자_권한_관리"
              columns={[
                { label: "사용자명", value: (u) => u.name },
                { label: "이메일", value: (u) => u.email },
                { label: "부서", value: (u) => u.dept },
                { label: "권한", value: (u) => u.role },
                { label: "담당 자산 수", value: (u) => u.assets },
                { label: "상태", value: (u) => (u.active ? "활성" : "비활성") },
              ]}
            />
            <ColumnVisibilityMenu
              allCols={USER_ALL_COLS}
              visible={userVisible}
              onChange={setUserVisible}
              factoryDefault={USER_FACTORY_VISIBLE}
              storageKey={USER_LS_KEY}
            />
          </div>
        }
      >
        <TableShell scrollHint>
          <thead>
            <tr>
              {showUserCol("name") && <SortTh col="name" label="사용자명" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("email") && <SortTh col="email" label="이메일" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("dept") && <SortTh col="dept" label="부서" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("role") && <SortTh col="role" label="권한" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("assets") && <SortTh col="assets" label="담당 자산 수" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("active") && <SortTh col="active" label="상태" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.email} className="transition-colors hover:bg-accent/40">
                {showUserCol("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{u.name}</Td>}
                {showUserCol("email") && <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{u.email}</Td>}
                {showUserCol("dept") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{u.dept}</Td>}
                {showUserCol("role") && <Td className={TABLE_ROW_CELL_H}><StatusBadge accent={roleAccent[u.role]}>{u.role}</StatusBadge></Td>}
                {showUserCol("assets") && <Td className={cn("font-mono", TABLE_ROW_CELL_H)}>{u.assets}</Td>}
                {showUserCol("active") && (
                  <Td className={TABLE_ROW_CELL_H}>
                    <StatusBadge accent={u.active ? "success" : "muted"}>
                      {u.active ? "활성" : "비활성"}
                    </StatusBadge>
                  </Td>
                )}
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 결과가 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      </SectionCard>

      {/* Section 6: Logs */}
      <SectionCard
        title="시스템 로그"
        subtitle="수집·승인·매핑 작업 이력"
        icon={ScrollText}
        action={
          <ExportExcelButton
            rows={logs}
            filename="시스템_로그"
            columns={[
              { label: "시간", value: (l) => l.time },
              { label: "작업 유형", value: (l) => l.type },
              { label: "대상", value: (l) => l.target },
              { label: "결과", value: (l) => l.result },
              { label: "수행자", value: (l) => l.who },
            ]}
          />
        }
      >
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
                  <StatusBadge risk={resultRisk[l.result]} pulse={l.result === "실패"}>
                    {l.result}
                  </StatusBadge>
                </Td>
                <Td className="text-muted-foreground">{l.who}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>
      </>
      )}
      </div>
    </div>
  )
}
