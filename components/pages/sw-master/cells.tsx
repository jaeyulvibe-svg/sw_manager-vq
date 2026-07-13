import {
  Monitor,
  Globe,
  Server,
  Database,
  Layers,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MasterCategory, CollectMode } from "./master-shared"

/* ---- 분류(카테고리)별 아이콘 — 표시 전용 ---- */
export const CATEGORY_ICONS: Record<MasterCategory, LucideIcon> = {
  OS: Monitor,
  WEB: Globe,
  WAS: Server,
  DB: Database,
  Middleware: Layers,
  Security: ShieldCheck,
}

const COLLECT_MODE_HINT: Record<CollectMode, string> = {
  AUTO: "AUTO: API 또는 RSS를 통한 자동 수집",
  SEMI_AUTO: "SEMI_AUTO: 자동 수집 후 관리자 보정 필요",
  MANUAL: "MANUAL: 관리자가 직접 입력",
}

const COLLECT_MODE_BADGE_STYLE: Record<CollectMode, string> = {
  AUTO: "text-[#7C3AED] bg-[#F5F3FF] border-[#C4B5FD] dark:text-[#D8B4FE] dark:bg-[#3B0764] dark:border-[#7C3AED]",
  SEMI_AUTO: "text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE] dark:text-[#93C5FD] dark:bg-[#172554] dark:border-[#2563EB]",
  MANUAL: "text-[#475569] bg-[#F8FAFC] border-[#CBD5E1] dark:text-[#CBD5E1] dark:bg-[#1E293B] dark:border-[#475569]",
}

const badgeBase = "inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-bold leading-none"

/* ---- 수집 모드 배지(조회 전용) ---- */
export function CollectModeBadge({ value }: { value: CollectMode }) {
  return (
    <span title={COLLECT_MODE_HINT[value]} className={cn(badgeBase, COLLECT_MODE_BADGE_STYLE[value])}>
      {value}
    </span>
  )
}

const USE_STATUS_BADGE_STYLE: Record<"사용" | "미사용", string> = {
  사용: "text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0] dark:text-[#86EFAC] dark:bg-[#052E16] dark:border-[#15803D]",
  미사용: "text-[#64748B] bg-[#F8FAFC] border-[#CBD5E1] dark:text-[#CBD5E1] dark:bg-[#1E293B] dark:border-[#475569]",
}

/* ---- 사용 여부 배지(조회 전용) ---- */
export function UseStatusBadge({ value }: { value: boolean }) {
  const label = value ? "사용" : "미사용"
  return <span className={cn(badgeBase, USE_STATUS_BADGE_STYLE[label])}>{label}</span>
}

/* ---- 분류 캡슐(조회 전용, 중립색) ---- */
export function CategoryCell({ value }: { value: MasterCategory }) {
  const Icon = CATEGORY_ICONS[value]
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/50 bg-muted/40 px-2.5 text-xs font-medium text-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {value}
    </span>
  )
}
