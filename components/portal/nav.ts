import {
  LayoutDashboard,
  Boxes,
  CalendarClock,
  FilePlus2,
  ClipboardCheck,
  ShieldAlert,
  Users,
  Presentation,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "request"
  | "approval"
  | "kisa"
  | "owner"
  | "manual"
  | "admin"

export type NavItem = {
  key: ViewKey
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  userOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "assets", label: "자산 목록", icon: Boxes },
  { key: "eos", label: "EOS 로드맵", icon: CalendarClock },
  { key: "request", label: "신규 자산 요청", icon: FilePlus2, userOnly: true },
  { key: "approval", label: "신규 자산 요청 승인", icon: ClipboardCheck, adminOnly: true },
  { key: "kisa", label: "KISA 취약점 공지", icon: ShieldAlert },
  { key: "owner", label: "소유자별 취약점 패치", icon: Users },
  { key: "manual", label: "소프트웨어 매뉴얼(PPT)", icon: Presentation },
  { key: "admin", label: "관리자 페이지", icon: Settings, adminOnly: true },
]

/** 현재 역할(관리자/사용자)에서 접근 가능한 메뉴만 반환 */
export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.userOnly && isAdmin) return false
    return true
  })
}

/** 특정 뷰가 현재 역할에서 접근 가능한지 여부 */
export function isViewAllowed(key: ViewKey, isAdmin: boolean): boolean {
  return visibleNavItems(isAdmin).some((item) => item.key === key)
}
