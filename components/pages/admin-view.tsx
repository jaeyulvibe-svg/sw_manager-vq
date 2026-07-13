"use client"

import { useEffect, useRef, useState } from "react"
import {
  Settings,
  Link2,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  Play,
  Zap,
  Lock,
  Minus,
  Plus,
  Type,
  Pencil,
  Trash2,
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
  usePagination,
  Pagination,
  ConfirmDialog,
  SelectionActionBar,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

/* ---- Shared input style for inline add/edit forms ---- */
const inputCls =
  "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

/* ---- Section: Source URL — 실 데이터(sources 테이블), 자동수집 대상 공식 출처 ---- */
type Source = Tables<"sources">

const SOURCE_CYCLES: Source["cycle"][] = ["1시간", "6시간", "일 1회"]
const SOURCE_STATUSES: Source["status"][] = ["정상", "지연", "실패"]

const sourceStatusRisk: Record<string, RiskLevel> = {
  정상: 1, 지연: 3, 실패: 4,
}

function formatLastCollected(iso: string | null) {
  if (!iso) return "-"
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${diffDays}일 전`
}

type SourceColKey = "name" | "type" | "url" | "cycle" | "last_collected_at" | "status"
const SOURCE_ALL_COLS: { key: SourceColKey; label: string }[] = [
  { key: "name", label: "제품명" },
  { key: "type", label: "Source 유형" },
  { key: "url", label: "공식 URL" },
  { key: "cycle", label: "수집 주기" },
  { key: "last_collected_at", label: "마지막 수집" },
  { key: "status", label: "상태" },
]
const SOURCE_FACTORY_VISIBLE: SourceColKey[] = SOURCE_ALL_COLS.map((c) => c.key)
const SOURCE_LS_KEY = "admin_source_columns"

type SourceSortKey = SourceColKey | "none"
const sourceStatusOrder: Record<string, number> = { 실패: 0, 지연: 1, 정상: 2 }

function sourceSortValue(s: Source, key: SourceSortKey): string | number {
  if (key === "status") return sourceStatusOrder[s.status] ?? 99
  if (key === "none") return 0
  return s[key] ?? ""
}

/* ---- Inline add/edit form for 공식 Source URL 관리 ---- */
type SourceFormValues = Pick<Source, "name" | "type" | "url" | "cycle" | "status">

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
          onChange={(e) => setValues((v) => ({ ...v, cycle: e.target.value as Source["cycle"] }))}
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
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as Source["status"] }))}
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
  masterId: string
  source_url: string
  source_type: SourceType
  notice_type: NoticeType
}

const EMPTY_MANUAL_VULN: ManualVulnFormValues = {
  cve: "",
  title: "",
  severity: "Medium",
  masterId: "",
  source_url: "",
  source_type: "vendor",
  notice_type: "CVE",
}

function ManualVulnFormPanel({
  masters,
  mastersLoading,
  onSubmit,
  submitting,
}: {
  masters: Tables<"sw_masters">[]
  mastersLoading: boolean
  onSubmit: (values: ManualVulnFormValues) => Promise<boolean>
  submitting: boolean
}) {
  const [values, setValues] = useState<ManualVulnFormValues>(EMPTY_MANUAL_VULN)
  const [productName, setProductName] = useState("")
  const canSubmit = values.cve.trim() && values.title.trim() && values.masterId

  const productNames = Array.from(new Set(masters.map((m) => m.name))).sort((a, b) =>
    a.localeCompare(b, "ko"),
  )
  const versionOptions = productName ? masters.filter((m) => m.name === productName) : []

  function handleProductChange(next: string) {
    setProductName(next)
    setValues((v) => ({ ...v, masterId: "" }))
  }

  async function handleSubmit() {
    if (!canSubmit) return
    const ok = await onSubmit(values)
    if (ok) {
      setValues(EMPTY_MANUAL_VULN)
      setProductName("")
    }
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
        <select
          value={productName}
          onChange={(e) => handleProductChange(e.target.value)}
          className={inputCls}
        >
          <option value="">
            {mastersLoading
              ? "불러오는 중..."
              : productNames.length === 0
                ? "등록된 제품이 없습니다"
                : "SW 마스터에 등록된 제품을 선택하세요"}
          </option>
          {productNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">버전</span>
        <select
          value={values.masterId}
          onChange={(e) => setValues((v) => ({ ...v, masterId: e.target.value }))}
          disabled={!productName}
          className={inputCls}
        >
          <option value="">
            {!productName ? "먼저 제품명을 선택하세요" : "버전을 선택하세요"}
          </option>
          {versionOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.std_version}</option>
          ))}
        </select>
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

/* ---- Section 5: users — 실 데이터(app_users 테이블) ---- */
type AppUser = Tables<"app_users">
type UserRow = AppUser & { assetsCount: number }

const USER_ROLES: AppUser["role"][] = ["관리자", "승인자", "담당자", "조회 사용자"]

const roleAccent: Record<string, Accent> = {
  관리자: "destructive", 승인자: "eos", 담당자: "primary", "조회 사용자": "muted",
}

type UserColKey = "name" | "email" | "dept" | "role" | "assetsCount" | "active"
const USER_ALL_COLS: { key: UserColKey; label: string }[] = [
  { key: "name", label: "사용자명" },
  { key: "email", label: "이메일" },
  { key: "dept", label: "부서" },
  { key: "role", label: "권한" },
  { key: "assetsCount", label: "담당 자산 수" },
  { key: "active", label: "상태" },
]
const USER_FACTORY_VISIBLE: UserColKey[] = USER_ALL_COLS.map((c) => c.key)
const USER_LS_KEY = "admin_users_columns"

type UserSortKey = UserColKey | "none"

function userSortValue(u: UserRow, key: UserSortKey): string | number {
  if (key === "active") return u.active ? 1 : 0
  if (key === "assetsCount") return u.assetsCount
  if (key === "none") return 0
  return u[key]
}

/* ---- Inline add/edit form for 사용자 권한 관리 ---- */
type UserFormValues = Pick<AppUser, "name" | "email" | "dept" | "role" | "active">

const EMPTY_USER_FORM: UserFormValues = {
  name: "",
  email: "",
  dept: "",
  role: "조회 사용자",
  active: true,
}

function UserFormPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: UserFormValues
  onCancel: () => void
  onSubmit: (values: UserFormValues) => void
}) {
  const [values, setValues] = useState<UserFormValues>(initial ?? EMPTY_USER_FORM)

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">사용자명</span>
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="예: 홍길동"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">이메일</span>
        <input
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          placeholder="예: gd.hong@corp.com"
          className={cn(inputCls, "font-mono")}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">부서</span>
        <input
          value={values.dept}
          onChange={(e) => setValues((v) => ({ ...v, dept: e.target.value }))}
          placeholder="예: WAS운영팀"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">권한</span>
        <select
          value={values.role}
          onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as AppUser["role"] }))}
          className={inputCls}
        >
          {USER_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        <select
          value={values.active ? "활성" : "비활성"}
          onChange={(e) => setValues((v) => ({ ...v, active: e.target.value === "활성" }))}
          className={inputCls}
        >
          <option>활성</option>
          <option>비활성</option>
        </select>
      </label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          onClick={() => values.name.trim() && values.email.trim() && onSubmit(values)}
          disabled={!values.name.trim() || !values.email.trim()}
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
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-[left]",
            checked ? "left-[22px]" : "left-0.5",
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

  const [policy, setPolicy] = useState<Tables<"admin_policies"> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("admin_policies")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPolicy(data)
      })
  }, [])

  async function updatePolicy(patch: Partial<TablesUpdate<"admin_policies">>) {
    if (!policy) return
    const previous = policy
    setPolicy({ ...policy, ...patch })
    const supabase = createClient()
    const { error } = await supabase.from("admin_policies").update(patch).eq("id", "default")
    if (error) {
      setPolicy(previous)
      toast({ title: "설정 저장 실패", description: error.message, tone: "danger" })
    }
  }

  const [sources, setSources] = useState<Source[]>([])
  const [sourcePanel, setSourcePanel] = useState<"add" | string | null>(null)
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
  const [sourceDeleteRequest, setSourceDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)
  const [sourceQuery, setSourceQuery] = useState("")
  const [sourceSortKey, setSourceSortKey] = useState<SourceSortKey>("name")
  const [sourceSortDir, setSourceSortDir] = useState<"asc" | "desc">("asc")
  const [sourceVisible, setSourceVisible] = useState<SourceColKey[]>(() =>
    loadColumnVisibility(SOURCE_LS_KEY, SOURCE_FACTORY_VISIBLE),
  )

  function loadSources() {
    const supabase = createClient()
    supabase
      .from("sources")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setSources(data)
      })
  }

  useEffect(() => {
    loadSources()
  }, [])

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
  const sourcePagination = usePagination(filteredSources)

  const [assets, setAssets] = useState<Tables<"assets">[]>([])
  const [manualVulnSubmitting, setManualVulnSubmitting] = useState(false)
  const [manualEosSubmitting, setManualEosSubmitting] = useState(false)
  const [masters, setMasters] = useState<Tables<"sw_masters">[]>([])
  const [mastersLoading, setMastersLoading] = useState(true)

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

  const eosNotifyClaimedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!policy?.eos_alert_180d || assets.length === 0) return
    const now = Date.now()
    const horizon = now + 180 * 86400000
    const due = assets.filter((a) => {
      if (!a.eos) return false
      const t = new Date(a.eos).getTime()
      return t >= now && t <= horizon
    })
    if (due.length === 0) return

    // 서버까지 포함해야 같은 제품명이 여러 서버에 설치된 경우에도 자산별로 구분된다.
    const titleFor = (a: Tables<"assets">) => `${a.name} (${a.server}) 지원종료(EOS) 180일 전 알림`

    // assets 참조가 바뀔 때마다(예: 수동 EOS 수정) 이 effect가 다시 실행될 수 있으므로,
    // DB 조회가 끝나기 전에 같은 자산을 두 번 시도하지 않도록 동기적으로 먼저 선점한다.
    const candidates = due.filter((a) => !eosNotifyClaimedRef.current.has(titleFor(a)))
    if (candidates.length === 0) return
    candidates.forEach((a) => eosNotifyClaimedRef.current.add(titleFor(a)))

    const supabase = createClient()
    supabase
      .from("notifications")
      .select("title")
      .in("title", candidates.map(titleFor))
      .then(({ data }) => {
        const existing = new Set((data ?? []).map((n) => n.title))
        const toInsert = candidates
          .filter((a) => !existing.has(titleFor(a)))
          .map((a) => ({
            category: "security" as const,
            title: titleFor(a),
            description: `${a.name} (${a.server}) 자산의 지원종료(EOS) 예정일이 ${a.eos}로, 180일 이내입니다. 교체·업그레이드 계획을 검토해주세요.`,
            asset: `${a.name} ${a.version}`,
            owner: a.owner,
            status: "확인필요" as const,
            urgent: false,
            link_view: "eos",
            link_label: "EOS 로드맵에서 보기",
          }))
        if (toInsert.length > 0) {
          supabase.from("notifications").insert(toInsert).then()
        }
      })
  }, [policy?.eos_alert_180d, assets])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("sw_masters")
      .select("*")
      .eq("active", true)
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => {
        if (data) setMasters(data)
        setMastersLoading(false)
      })
  }, [])

  const [users, setUsers] = useState<AppUser[]>([])
  const [userPanel, setUserPanel] = useState<"add" | string | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [userDeleteRequest, setUserDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)
  const [userQuery, setUserQuery] = useState("")
  const [userSortKey, setUserSortKey] = useState<UserSortKey>("name")
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc")
  const [userVisible, setUserVisible] = useState<UserColKey[]>(() =>
    loadColumnVisibility(USER_LS_KEY, USER_FACTORY_VISIBLE),
  )

  function loadUsers() {
    const supabase = createClient()
    supabase
      .from("app_users")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setUsers(data)
      })
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function handleUserSort(col: UserSortKey) {
    if (userSortKey === col) setUserSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setUserSortKey(col)
      setUserSortDir("asc")
    }
  }

  // 담당 자산 수는 저장된 값이 아니라 assets.owner를 이름으로 매칭해 실시간 계산한다
  const usersWithCounts: UserRow[] = users.map((u) => ({
    ...u,
    assetsCount: assets.filter((a) => a.owner === u.name).length,
  }))

  const filteredUsers = usersWithCounts
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
  const userPagination = usePagination(filteredUsers)

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

  async function saveSource(values: SourceFormValues) {
    const supabase = createClient()
    if (sourcePanel === "add") {
      const payload: TablesInsert<"sources"> = { ...values }
      const { error } = await supabase.from("sources").insert(payload)
      if (error) {
        toast({ title: "Source URL 추가 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "Source URL이 추가되었습니다", tone: "success" })
    } else if (sourcePanel) {
      const { error } = await supabase.from("sources").update(values).eq("id", sourcePanel)
      if (error) {
        toast({ title: "Source URL 수정 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "Source URL이 수정되었습니다", tone: "success" })
    }
    setSourcePanel(null)
    loadSources()
  }

  function requestDeleteOneSource(target: Source) {
    setSourceDeleteRequest({
      ids: [target.id],
      title: `"${target.name}" Source URL을 삭제할까요?`,
      confirmLabel: "1개 삭제",
    })
  }
  function requestDeleteSelectedSources() {
    if (selectedSourceIds.size === 0) return
    setSourceDeleteRequest({
      ids: Array.from(selectedSourceIds),
      title: `선택한 Source URL ${selectedSourceIds.size}개를 삭제할까요?`,
      confirmLabel: `${selectedSourceIds.size}개 삭제`,
    })
  }
  async function confirmDeleteSources() {
    if (!sourceDeleteRequest) return
    const supabase = createClient()
    const { error } = await supabase.from("sources").delete().in("id", sourceDeleteRequest.ids)
    if (error) {
      toast({ title: "삭제 실패", description: error.message, tone: "danger" })
      setSourceDeleteRequest(null)
      return
    }
    toast({ title: `Source URL ${sourceDeleteRequest.ids.length}건이 삭제되었습니다`, tone: "info" })
    setSelectedSourceIds(new Set())
    setSourceDeleteRequest(null)
    loadSources()
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

  function clearSourceSelection() {
    setSelectedSourceIds(new Set())
  }

  async function saveUser(values: UserFormValues) {
    const supabase = createClient()
    if (userPanel === "add") {
      const payload: TablesInsert<"app_users"> = { ...values }
      const { error } = await supabase.from("app_users").insert(payload)
      if (error) {
        toast({ title: "사용자 추가 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "사용자가 추가되었습니다", tone: "success" })
    } else if (userPanel) {
      const { error } = await supabase.from("app_users").update(values).eq("id", userPanel)
      if (error) {
        toast({ title: "사용자 수정 실패", description: error.message, tone: "danger" })
        return
      }
      toast({ title: "사용자 정보가 수정되었습니다", tone: "success" })
    }
    setUserPanel(null)
    loadUsers()
  }

  function requestDeleteOneUser(target: AppUser) {
    setUserDeleteRequest({
      ids: [target.id],
      title: `"${target.name}" 사용자를 삭제할까요?`,
      confirmLabel: "1개 삭제",
    })
  }
  function requestDeleteSelectedUsers() {
    if (selectedUserIds.size === 0) return
    setUserDeleteRequest({
      ids: Array.from(selectedUserIds),
      title: `선택한 사용자 ${selectedUserIds.size}개를 삭제할까요?`,
      confirmLabel: `${selectedUserIds.size}개 삭제`,
    })
  }
  async function confirmDeleteUsers() {
    if (!userDeleteRequest) return
    const supabase = createClient()
    const { error } = await supabase.from("app_users").delete().in("id", userDeleteRequest.ids)
    if (error) {
      toast({ title: "삭제 실패", description: error.message, tone: "danger" })
      setUserDeleteRequest(null)
      return
    }
    toast({ title: `사용자 ${userDeleteRequest.ids.length}건이 삭제되었습니다`, tone: "info" })
    setSelectedUserIds(new Set())
    setUserDeleteRequest(null)
    loadUsers()
  }

  function toggleUserSelectAll() {
    setSelectedUserIds((prev) =>
      prev.size === filteredUsers.length ? new Set() : new Set(filteredUsers.map((u) => u.id)),
    )
  }

  function toggleUserSelected(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearUserSelection() {
    setSelectedUserIds(new Set())
  }

  async function submitManualVuln(values: ManualVulnFormValues): Promise<boolean> {
    const master = masters.find((m) => m.id === values.masterId)
    if (!master) return false
    setManualVulnSubmitting(true)
    const supabase = createClient()
    const payload: TablesInsert<"vulnerabilities"> = {
      cve: values.cve.trim(),
      title: values.title.trim(),
      severity: values.severity,
      product: `${master.name} ${master.std_version}`,
      source: values.source_type === "kisa" ? "KISA 보안공지" : `${master.name} 공식 보안 공지`,
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

      const supabase = createClient()
      const nowIso = new Date().toISOString()
      await Promise.all(
        results.map((r) =>
          supabase
            .from("sources")
            .update({ status: r.ok ? "정상" : "실패", last_collected_at: nowIso })
            .eq("name", r.product),
        ),
      )
      loadSources()

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
          sourcePanel ? null : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={sourceQuery}
                  onChange={(e) => { setSourceQuery(e.target.value); sourcePagination.setPage(1) }}
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
                  { label: "마지막 수집", value: (s: Source) => formatLastCollected(s.last_collected_at) },
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
            </div>
          )
        }
      >
        {sourcePanel === "add" ? (
          <SourceFormPanel onCancel={() => setSourcePanel(null)} onSubmit={saveSource} />
        ) : null}
        <SelectionActionBar count={selectedSourceIds.size} onClear={clearSourceSelection} onDelete={requestDeleteSelectedSources} />
        <TableShell scrollHint>
          <thead>
            <tr>
              <Th className={cn("w-8", TABLE_HEADER_CELL_H)}>
                <input
                  type="checkbox"
                  checked={filteredSources.length > 0 && selectedSourceIds.size === filteredSources.length}
                  onChange={toggleSourceSelectAll}
                  aria-label="전체 선택"
                  className="h-4 w-4 rounded border-border/60 accent-primary"
                />
              </Th>
              {showSourceCol("name") && <SortTh col="name" label="제품명" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("type") && <SortTh col="type" label="Source 유형" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("url") && <SortTh col="url" label="공식 URL" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("cycle") && <SortTh col="cycle" label="수집 주기" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("last_collected_at") && <SortTh col="last_collected_at" label="마지막 수집" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("status") && <SortTh col="status" label="상태" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              <Th className={TABLE_HEADER_CELL_H}>관리</Th>
            </tr>
          </thead>
          <tbody>
            {sourcePagination.pageItems.map((s) =>
              sourcePanel === s.id ? (
                <tr key={s.id}>
                  <td colSpan={8} className="border-b border-border/40 p-0">
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
                  <Td className={TABLE_ROW_CELL_H}>
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.has(s.id)}
                      onChange={() => toggleSourceSelected(s.id)}
                      aria-label={`${s.name} 선택`}
                      className="h-4 w-4 rounded border-border/60 accent-primary"
                    />
                  </Td>
                  {showSourceCol("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{s.name}</Td>}
                  {showSourceCol("type") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{s.type}</Td>}
                  {showSourceCol("url") && <Td className={cn("font-mono text-xs text-primary", TABLE_ROW_CELL_H)}>{s.url}</Td>}
                  {showSourceCol("cycle") && <Td className={cn("text-xs", TABLE_ROW_CELL_H)}>{s.cycle}</Td>}
                  {showSourceCol("last_collected_at") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{formatLastCollected(s.last_collected_at)}</Td>}
                  {showSourceCol("status") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={sourceStatusRisk[s.status]} pulse={s.status === "실패"}>
                        {s.status}
                      </StatusBadge>
                    </Td>
                  )}
                  <Td className={TABLE_ROW_CELL_H}>
                    <div className="flex items-center gap-1.5">
                      <MiniButton className="h-8 px-2.5" onClick={() => setSourcePanel(s.id)}>
                        <Pencil className="h-3 w-3" />
                        수정
                      </MiniButton>
                      <MiniButton accent="destructive" className="h-8 px-2.5" onClick={() => requestDeleteOneSource(s)}>
                        <Trash2 className="h-3 w-3" />
                        삭제
                      </MiniButton>
                    </div>
                  </Td>
                </tr>
              ),
            )}
          </tbody>
        </TableShell>
        {filteredSources.length > 0 && (
          <div className="mt-3">
            <Pagination
              page={sourcePagination.page}
              pageSize={sourcePagination.pageSize}
              totalPages={sourcePagination.totalPages}
              onPageChange={sourcePagination.setPage}
              onPageSizeChange={sourcePagination.setPageSize}
            />
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!sourceDeleteRequest}
        title={sourceDeleteRequest?.title ?? ""}
        description="삭제 후에는 목록에서 제거됩니다."
        confirmLabel={sourceDeleteRequest?.confirmLabel ?? ""}
        onConfirm={confirmDeleteSources}
        onCancel={() => setSourceDeleteRequest(null)}
      />

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
            <Toggle
              label="자동 수집 스케줄러"
              desc="공식 Source 주기적 자동 수집"
              checked={policy?.auto_collect_enabled ?? true}
              disabled={!policy}
              onChange={(next) => updatePolicy({ auto_collect_enabled: next })}
            />

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
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            신규 {entry.newCount}건
                          </span>
                          <StatusBadge
                            accent={entry.ok ? "success" : "destructive"}
                            pulse={!entry.ok}
                          >
                            {entry.ok ? "성공" : "실패"}
                          </StatusBadge>
                        </div>
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
          <ManualVulnFormPanel
            masters={masters}
            mastersLoading={mastersLoading}
            onSubmit={submitManualVuln}
            submitting={manualVulnSubmitting}
          />
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
          <Toggle
            label="Critical 자동 긴급 알림"
            desc="Critical 취약점 승인 시 담당자에게 즉시 알림 (끄면 Critical 승인 시 알림을 생성하지 않습니다)"
            checked={policy?.critical_urgent_alert ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ critical_urgent_alert: next })}
          />
          <Toggle
            label="High 이상 관리자 승인 필수"
            desc="켜면(기본) 모든 등급이 수동 승인 필요. 끄면 즉시 수집으로 들어온 Medium/Low 공지는 자동 승인됩니다(High/Critical은 항상 수동 승인)"
            checked={policy?.high_requires_approval ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ high_requires_approval: next })}
          />
          <Toggle
            label="EOS 180일 전 알림"
            desc="지원 종료 180일 이내 자산을 관리자 페이지 접속 시 확인해 담당자에게 1회 알림"
            checked={policy?.eos_alert_180d ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ eos_alert_180d: next })}
          />
          <Toggle
            label="패치 공지 수집 후 승인 대기 등록"
            desc="켜면(기본) 즉시 수집 결과가 승인 대기 큐로 들어감. 끄면 심각도 무관 즉시 승인완료 처리(수동 등록은 영향 없음)"
            checked={policy?.queue_after_collect ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ queue_after_collect: next })}
          />
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
          userPanel ? null : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={userQuery}
                  onChange={(e) => { setUserQuery(e.target.value); userPagination.setPage(1) }}
                  placeholder="이름, 이메일, 부서 검색"
                  className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <ExportExcelButton
                rows={filteredUsers}
                filename="사용자_권한_관리"
                columns={[
                  { label: "사용자명", value: (u: UserRow) => u.name },
                  { label: "이메일", value: (u: UserRow) => u.email },
                  { label: "부서", value: (u: UserRow) => u.dept },
                  { label: "권한", value: (u: UserRow) => u.role },
                  { label: "담당 자산 수", value: (u: UserRow) => u.assetsCount },
                  { label: "상태", value: (u: UserRow) => (u.active ? "활성" : "비활성") },
                ]}
              />
              <ColumnVisibilityMenu
                allCols={USER_ALL_COLS}
                visible={userVisible}
                onChange={setUserVisible}
                factoryDefault={USER_FACTORY_VISIBLE}
                storageKey={USER_LS_KEY}
              />
              <MiniButton accent="primary" onClick={() => setUserPanel("add")}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </MiniButton>
            </div>
          )
        }
      >
        {userPanel === "add" ? (
          <UserFormPanel onCancel={() => setUserPanel(null)} onSubmit={saveUser} />
        ) : null}
        <SelectionActionBar count={selectedUserIds.size} onClear={clearUserSelection} onDelete={requestDeleteSelectedUsers} />
        <TableShell scrollHint>
          <thead>
            <tr>
              <Th className={cn("w-8", TABLE_HEADER_CELL_H)}>
                <input
                  type="checkbox"
                  checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                  onChange={toggleUserSelectAll}
                  aria-label="전체 선택"
                  className="h-4 w-4 rounded border-border/60 accent-primary"
                />
              </Th>
              {showUserCol("name") && <SortTh col="name" label="사용자명" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("email") && <SortTh col="email" label="이메일" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("dept") && <SortTh col="dept" label="부서" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("role") && <SortTh col="role" label="권한" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("assetsCount") && <SortTh col="assetsCount" label="담당 자산 수" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("active") && <SortTh col="active" label="상태" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              <Th className={TABLE_HEADER_CELL_H}>관리</Th>
            </tr>
          </thead>
          <tbody>
            {userPagination.pageItems.map((u) =>
              userPanel === u.id ? (
                <tr key={u.id}>
                  <td colSpan={8} className="border-b border-border/40 p-0">
                    <UserFormPanel
                      initial={{
                        name: u.name,
                        email: u.email,
                        dept: u.dept,
                        role: u.role,
                        active: u.active,
                      }}
                      onCancel={() => setUserPanel(null)}
                      onSubmit={saveUser}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={u.id} className="transition-colors hover:bg-accent/40">
                  <Td className={TABLE_ROW_CELL_H}>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleUserSelected(u.id)}
                      aria-label={`${u.name} 선택`}
                      className="h-4 w-4 rounded border-border/60 accent-primary"
                    />
                  </Td>
                  {showUserCol("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{u.name}</Td>}
                  {showUserCol("email") && <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{u.email}</Td>}
                  {showUserCol("dept") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{u.dept}</Td>}
                  {showUserCol("role") && <Td className={TABLE_ROW_CELL_H}><StatusBadge accent={roleAccent[u.role]}>{u.role}</StatusBadge></Td>}
                  {showUserCol("assetsCount") && <Td className={cn("font-mono", TABLE_ROW_CELL_H)}>{u.assetsCount}</Td>}
                  {showUserCol("active") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge accent={u.active ? "success" : "muted"}>
                        {u.active ? "활성" : "비활성"}
                      </StatusBadge>
                    </Td>
                  )}
                  <Td className={TABLE_ROW_CELL_H}>
                    <div className="flex items-center gap-1.5">
                      <MiniButton className="h-8 px-2.5" onClick={() => setUserPanel(u.id)}>
                        <Pencil className="h-3 w-3" />
                        수정
                      </MiniButton>
                      <MiniButton accent="destructive" className="h-8 px-2.5" onClick={() => requestDeleteOneUser(u)}>
                        <Trash2 className="h-3 w-3" />
                        삭제
                      </MiniButton>
                    </div>
                  </Td>
                </tr>
              ),
            )}
            {filteredUsers.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 결과가 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
        {filteredUsers.length > 0 && (
          <div className="mt-3">
            <Pagination
              page={userPagination.page}
              pageSize={userPagination.pageSize}
              totalPages={userPagination.totalPages}
              onPageChange={userPagination.setPage}
              onPageSizeChange={userPagination.setPageSize}
            />
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!userDeleteRequest}
        title={userDeleteRequest?.title ?? ""}
        description="삭제 후에는 목록에서 제거됩니다."
        confirmLabel={userDeleteRequest?.confirmLabel ?? ""}
        onConfirm={confirmDeleteUsers}
        onCancel={() => setUserDeleteRequest(null)}
      />
      </>
      )}
      </div>
    </div>
  )
}
