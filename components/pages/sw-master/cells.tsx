"use client"

import { useEffect, useRef, useState } from "react"
import {
  Eye,
  Copy,
  Trash2,
  Undo2,
  RotateCcw,
  MoreVertical,
  X,
  Monitor,
  Globe,
  Server,
  Database,
  Layers,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { EditableFields, EffectiveRow } from "./use-master-draft"
import { MASTER_CATEGORIES, COLLECT_MODES, FIELD_LABELS } from "./use-master-draft"

/* ---- 분류(카테고리)별 아이콘 — 표시 전용, 저장/엑셀 추출 값(문자열)에는 영향 없음 ---- */
export const CATEGORY_ICONS: Record<EditableFields["category"], LucideIcon> = {
  OS: Monitor,
  WEB: Globe,
  WAS: Server,
  DB: Database,
  Middleware: Layers,
  Security: ShieldCheck,
}

const inputBase =
  "w-full rounded-md border bg-transparent px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none"

function DirtyDot() {
  return (
    <span className="absolute -left-1 -top-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
  )
}

function requiredBorder(value: string, error: string | undefined, required: boolean | undefined) {
  if (error) return "border-destructive/60"
  if (required && !value.trim()) return "border-dashed border-warning/60"
  return "border-transparent hover:border-border/60"
}

/* ---- Text cell (제품명 / 표준 버전 / 관리자 / 비고) ---- */
export function EditableText({
  value,
  onChange,
  dirty,
  error,
  required,
  placeholder,
  bold,
}: {
  value: string
  onChange: (next: string) => void
  dirty?: boolean
  error?: string
  required?: boolean
  placeholder?: string
  bold?: boolean
}) {
  return (
    <div className={cn("relative", dirty && "rounded-md bg-primary/8")}>
      {dirty ? <DirtyDot /> : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (required ? "필수" : undefined)}
        className={cn(inputBase, bold && "font-semibold", requiredBorder(value, error, required))}
      />
      {error ? <p className="mt-0.5 text-[10px] text-destructive">{error}</p> : null}
    </div>
  )
}

/* ---- Vendor cell — 검색 가능한 드롭다운(datalist) ---- */
export function EditableVendor({
  rowId,
  value,
  onChange,
  options,
  dirty,
  error,
  required,
}: {
  rowId: string
  value: string
  onChange: (next: string) => void
  options: string[]
  dirty?: boolean
  error?: string
  required?: boolean
}) {
  const listId = `vendor-options-${rowId}`
  return (
    <div className={cn("relative", dirty && "rounded-md bg-primary/8")}>
      {dirty ? <DirtyDot /> : null}
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={required ? "필수" : "벤더 검색/입력"}
        className={cn(inputBase, requiredBorder(value, error, required))}
      />
      <datalist id={listId}>
        {options.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {error ? <p className="mt-0.5 text-[10px] text-destructive">{error}</p> : null}
    </div>
  )
}

/* ---- Select cell (분류 / 수집 모드) ---- */
export function EditableSelect({
  value,
  onChange,
  options,
  dirty,
}: {
  value: string
  onChange: (next: string) => void
  options: readonly string[]
  dirty?: boolean
}) {
  return (
    <div className={cn("relative", dirty && "rounded-md bg-primary/8")}>
      {dirty ? <DirtyDot /> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, "border-transparent hover:border-border/60")}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

const COLLECT_MODE_HINT: Record<(typeof COLLECT_MODES)[number], string> = {
  AUTO: "AUTO: API 또는 RSS를 통한 자동 수집",
  SEMI_AUTO: "SEMI_AUTO: 자동 수집 후 관리자 보정 필요",
  MANUAL: "MANUAL: 관리자가 직접 입력",
}

export function EditableCollectMode({
  value,
  onChange,
  dirty,
}: {
  value: EditableFields["collect_mode"]
  onChange: (next: EditableFields["collect_mode"]) => void
  dirty?: boolean
}) {
  return (
    <div title={COLLECT_MODE_HINT[value]}>
      <EditableSelect value={value} onChange={(v) => onChange(v as EditableFields["collect_mode"])} options={COLLECT_MODES} dirty={dirty} />
    </div>
  )
}

export function EditableCategory({
  value,
  onChange,
  dirty,
}: {
  value: EditableFields["category"]
  onChange: (next: EditableFields["category"]) => void
  dirty?: boolean
}) {
  const Icon = CATEGORY_ICONS[value]
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <EditableSelect value={value} onChange={(v) => onChange(v as EditableFields["category"])} options={MASTER_CATEGORIES} dirty={dirty} />
    </div>
  )
}

/* ---- 사용 여부 토글 ---- */
export function ActiveToggle({
  value,
  onChange,
  dirty,
}: {
  value: boolean
  onChange: (next: boolean) => void
  dirty?: boolean
}) {
  return (
    <div className={cn("relative inline-flex", dirty && "rounded-md bg-primary/8 p-0.5")}>
      {dirty ? <DirtyDot /> : null}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          value ? "bg-success" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-[left]",
            value ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  )
}

/* ---- 행 상태 배지 ---- */
export function RowStatusBadge({ status }: { status: EffectiveRow["status"] }) {
  if (status === "added") {
    return (
      <span className="inline-flex items-center rounded-md border border-success/40 bg-success/12 px-1.5 py-0.5 text-[10px] font-semibold text-success">
        신규
      </span>
    )
  }
  if (status === "deleted") {
    return (
      <span className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/12 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
        삭제 예정
      </span>
    )
  }
  if (status === "modified") {
    return (
      <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning/12 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
        수정됨
      </span>
    )
  }
  return null
}

/* ---- 행 더보기(⋮) 메뉴 ---- */
export function RowMenu({
  row,
  onDetail,
  onDuplicate,
  onToggleDelete,
  onRevert,
}: {
  row: EffectiveRow
  onDetail: () => void
  onDuplicate: () => void
  onToggleDelete: () => void
  onRevert: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="행 메뉴"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
          open && "bg-accent/60 text-foreground",
        )}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute left-0 top-7 z-50 w-40 rounded-xl border border-border/70 bg-card py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              onDetail()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent/60"
          >
            <Eye className="h-3.5 w-3.5" />
            상세 보기
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicate()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent/60"
          >
            <Copy className="h-3.5 w-3.5" />
            행 복제
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleDelete()
              setOpen(false)
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent/60",
              row.status === "deleted" ? "text-foreground" : "text-destructive",
            )}
          >
            {row.status === "deleted" ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
            {row.status === "deleted" ? "삭제 취소" : "삭제 예정"}
          </button>
          {row.status !== "clean" ? (
            <button
              type="button"
              onClick={() => {
                onRevert()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              변경 취소
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ---- 상세 보기 모달 ---- */
export function MasterDetailModal({ row, onClose }: { row: EffectiveRow | null; onClose: () => void }) {
  useEffect(() => {
    if (!row) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [row, onClose])

  if (!row) return null

  const facts: { label: string; value: string; icon?: LucideIcon }[] = [
    { label: "마스터 ID", value: row.id },
    { label: FIELD_LABELS.name, value: row.values.name || "-" },
    { label: FIELD_LABELS.vendor, value: row.values.vendor || "-" },
    { label: FIELD_LABELS.category, value: row.values.category, icon: CATEGORY_ICONS[row.values.category] },
    { label: FIELD_LABELS.std_version, value: row.values.std_version || "-" },
    { label: FIELD_LABELS.collect_mode, value: row.values.collect_mode },
    { label: FIELD_LABELS.active, value: row.values.active ? "사용" : "미사용" },
    { label: FIELD_LABELS.manager, value: row.values.manager || "-" },
    { label: FIELD_LABELS.note, value: row.values.note || "-" },
    { label: "최근 갱신일", value: row.updatedAt ? new Date(row.updatedAt).toLocaleString("ko-KR") : "-" },
    { label: "수정자", value: row.updatedBy || "-" },
  ]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="animate-overlay absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${row.values.name} 상세`}
        className="glass relative flex w-full max-w-md flex-col rounded-2xl border border-primary/25 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-base font-bold text-foreground">SW 마스터 상세</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 py-5">
          {facts.map((f) => (
            <div key={f.label} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                {f.icon ? <f.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                {f.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
