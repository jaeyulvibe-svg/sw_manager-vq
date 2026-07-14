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
  Megaphone,
  ListChecks,
  RotateCcw,
  type LucideIcon,
} from "lucide-react"

export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "notice-board"
  | "request"
  | "approval"
  | "kisa"
  | "vendor"
  | "eos-notice"
  | "patch"
  | "patch-tasks"
  | "admin-master"
  | "admin-servers"
  | "admin-collect"
  | "admin-policy"
  | "admin-users"
  | "admin-demo"
  | "notifications"

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
  { key: "patch-tasks", label: "조치 업무", icon: ListChecks },
  {
    groupKey: "asset-mgmt",
    label: "자산 관리",
    icon: Boxes,
    children: [
      { key: "assets", label: "자산 목록", icon: Boxes },
      { key: "eos", label: "EOS 로드맵", icon: CalendarClock },
    ],
  },
  {
    groupKey: "security-mgmt",
    label: "보안 관리",
    icon: ShieldAlert,
    children: [
      { key: "notice-board", label: "보안 공지", icon: Megaphone },
      { key: "patch", label: "패치 현황", icon: ShieldCheck },
    ],
  },
  {
    groupKey: "request-mgmt",
    label: "요청 관리",
    icon: ClipboardCheck,
    children: [
      { key: "request", label: "요청 현황", icon: FilePlus2, userOnly: true },
      { key: "approval", label: "승인 현황", icon: ClipboardCheck, adminOnly: true },
    ],
  },
  {
    groupKey: "notice-collect",
    label: "공지 수집",
    icon: Megaphone,
    children: [
      { key: "kisa", label: "KISA 공지", icon: ShieldAlert },
      { key: "vendor", label: "제조사 공지", icon: ShieldAlert },
      { key: "eos-notice", label: "EOS 공지", icon: CalendarClock },
    ],
  },
  { key: "notifications", label: "알림", icon: Bell },
  {
    groupKey: "system-mgmt",
    label: "시스템 관리",
    icon: Settings,
    adminOnly: true,
    children: [
      { key: "admin-master", label: "SW 마스터", icon: Database },
      { key: "admin-servers", label: "서버 관리", icon: Server },
      { key: "admin-collect", label: "수집 관리", icon: RefreshCw },
      { key: "admin-policy", label: "정책 설정", icon: ShieldCheck },
      { key: "admin-users", label: "사용자 관리", icon: UsersRound },
      { key: "admin-demo", label: "DEMO 데이터 설정", icon: RotateCcw },
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
  return visibleNavItems(isAdmin).some((entry) =>
    isNavGroup(entry) ? entry.children.some((c) => c.key === key) : entry.key === key,
  )
}
