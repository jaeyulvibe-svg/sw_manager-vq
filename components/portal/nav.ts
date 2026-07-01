import {
  LayoutDashboard,
  Boxes,
  CalendarClock,
  FilePlus2,
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
  | "kisa"
  | "owner"
  | "manual"
  | "admin"

export type NavItem = {
  key: ViewKey
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "assets", label: "자산 목록", icon: Boxes },
  { key: "eos", label: "EOS 로드맵", icon: CalendarClock },
  { key: "request", label: "신규 자산 요청", icon: FilePlus2 },
  { key: "kisa", label: "KISA 취약점 공지", icon: ShieldAlert },
  { key: "owner", label: "소유자별 취약점 패치", icon: Users },
  { key: "manual", label: "소프트웨어 매뉴얼(PPT)", icon: Presentation },
  { key: "admin", label: "관리자 페이지", icon: Settings },
]
