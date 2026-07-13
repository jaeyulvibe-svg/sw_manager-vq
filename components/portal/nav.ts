import {
  LayoutDashboard,
  Boxes,
  CalendarClock,
  FilePlus2,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Bell,
  Database,
  RefreshCw,
  UsersRound,
  Server,
  type LucideIcon,
} from "lucide-react"

export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "request"
  | "approval"
  | "kisa"
  | "vendor"
  | "eos-notice"
  | "patch"
  | "admin-master"
  | "admin-servers"
  | "admin-collect"
  | "admin-policy"
  | "admin-users"
  | "notifications"

/** 사이드바에는 표시하지 않지만 헤더 타이틀 등에 사용하는 뷰 메타 */
export const EXTRA_VIEW_META: Record<
  string,
  { label: string; icon: LucideIcon }
> = {
  notifications: { label: "알림 센터", icon: Bell },
}

export type NavItem = {
  key: ViewKey
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  userOnly?: boolean
}

/** 사이드바에서 하위 메뉴로 묶여 펼쳐지는 그룹 (예: 관리자 페이지) */
export type NavGroup = {
  groupKey: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  userOnly?: boolean
  children: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry
}

export const NAV_ITEMS: NavEntry[] = [
  { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "assets", label: "자산 목록", icon: Boxes },
  { key: "eos", label: "EOS 로드맵", icon: CalendarClock },
  { key: "request", label: "신규 자산 요청", icon: FilePlus2, userOnly: true },
  { key: "approval", label: "신규 자산 요청 승인", icon: ClipboardCheck, adminOnly: true },
  {
    groupKey: "vuln-notice",
    label: "취약점 공지",
    icon: ShieldAlert,
    children: [
      { key: "kisa", label: "KISA 취약점 공지", icon: ShieldAlert },
      { key: "vendor", label: "제조사 취약점 공지", icon: ShieldAlert },
      { key: "eos-notice", label: "EOS 공지", icon: CalendarClock },
      { key: "patch", label: "승인된 취약점 공지", icon: ShieldCheck },
    ],
  },
  {
    groupKey: "admin",
    label: "관리자 페이지",
    icon: Settings,
    adminOnly: true,
    children: [
      { key: "admin-master", label: "SW 마스터 관리", icon: Database },
      { key: "admin-servers", label: "서버 관리", icon: Server },
      { key: "admin-collect", label: "수집 관리", icon: RefreshCw },
      { key: "admin-policy", label: "승인 정책", icon: ShieldCheck },
      { key: "admin-users", label: "사용자·로그", icon: UsersRound },
    ],
  },
]

function matchesRole(entry: { adminOnly?: boolean; userOnly?: boolean }, isAdmin: boolean) {
  if (entry.adminOnly && !isAdmin) return false
  if (entry.userOnly && isAdmin) return false
  return true
}

/** 현재 역할(관리자/사용자)에서 접근 가능한 메뉴만 반환 */
export function visibleNavItems(isAdmin: boolean): NavEntry[] {
  return NAV_ITEMS.filter((entry) => matchesRole(entry, isAdmin)).map((entry) =>
    isNavGroup(entry)
      ? { ...entry, children: entry.children.filter((c) => matchesRole(c, isAdmin)) }
      : entry,
  )
}

/** 특정 뷰가 현재 역할에서 접근 가능한지 여부 */
export function isViewAllowed(key: ViewKey, isAdmin: boolean): boolean {
  if (key in EXTRA_VIEW_META) return true
  return visibleNavItems(isAdmin).some((entry) =>
    isNavGroup(entry) ? entry.children.some((c) => c.key === key) : entry.key === key,
  )
}
