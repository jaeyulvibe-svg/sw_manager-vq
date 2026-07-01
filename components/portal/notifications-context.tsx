"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  Boxes,
  CalendarClock,
  Download,
  ShieldAlert,
  ClipboardCheck,
  Server,
  type LucideIcon,
} from "lucide-react"
import type { Accent } from "./ui"
import type { ViewKey } from "./nav"

export type NotifCategory =
  | "asset"
  | "eos"
  | "patch"
  | "security"
  | "approval"
  | "system"

export type NotifStatus =
  | "확인필요"
  | "승인대기"
  | "검토중"
  | "완료"
  | "긴급"

export type Notification = {
  id: string
  category: NotifCategory
  title: string
  description: string
  time: string
  /** sort key: smaller = more recent */
  order: number
  asset: string
  owner: string
  status: NotifStatus
  urgent?: boolean
  read: boolean
  link: { label: string; view: ViewKey }
}

export const CATEGORY_META: Record<
  NotifCategory,
  { label: string; icon: LucideIcon; accent: Accent }
> = {
  asset: { label: "자산관리", icon: Boxes, accent: "primary" },
  eos: { label: "EOS", icon: CalendarClock, accent: "eos" },
  patch: { label: "패치", icon: Download, accent: "warning" },
  security: { label: "보안공지", icon: ShieldAlert, accent: "destructive" },
  approval: { label: "승인", icon: ClipboardCheck, accent: "primary" },
  system: { label: "시스템", icon: Server, accent: "muted" },
}

export const STATUS_ACCENT: Record<NotifStatus, Accent> = {
  긴급: "destructive",
  승인대기: "primary",
  확인필요: "warning",
  검토중: "warning",
  완료: "success",
}

const SEED: Notification[] = [
  {
    id: "N1",
    category: "approval",
    title: "OpenSSL 패치 공지 승인 대기",
    description: "OpenSSL 3.0.x 관련 신규 패치 공지가 수집되었습니다.",
    time: "5분 전",
    order: 5,
    asset: "OpenSSL 3.0.x",
    owner: "정재율",
    status: "승인대기",
    urgent: true,
    read: false,
    link: { label: "승인 관리로 이동", view: "approval" },
  },
  {
    id: "N2",
    category: "eos",
    title: "JEUS 7 EOS 임박",
    description: "JEUS 7 자산의 EOS 일정이 6개월 이내로 접근했습니다.",
    time: "20분 전",
    order: 20,
    asset: "JEUS 7",
    owner: "김철수",
    status: "확인필요",
    urgent: true,
    read: false,
    link: { label: "EOS 관리로 이동", view: "eos" },
  },
  {
    id: "N3",
    category: "asset",
    title: "신규 SW 자산 등록 요청",
    description: "Apache Tomcat 자산 등록 요청이 접수되었습니다.",
    time: "35분 전",
    order: 35,
    asset: "Apache Tomcat",
    owner: "홍길동",
    status: "승인대기",
    read: false,
    link: { label: "신규 자산 요청으로 이동", view: "approval" },
  },
  {
    id: "N4",
    category: "security",
    title: "KNVD 긴급 보안공지 수집",
    description: "Apache Tomcat 관련 High 등급 취약점 공지가 수집되었습니다.",
    time: "1시간 전",
    order: 60,
    asset: "Apache Tomcat 9.0.x",
    owner: "홍길동",
    status: "검토중",
    urgent: true,
    read: false,
    link: { label: "보안공지 관리로 이동", view: "kisa" },
  },
  {
    id: "N5",
    category: "patch",
    title: "Oracle DB 패치 확인 필요",
    description: "Oracle Database 19c 관련 Critical Patch Update가 수집되었습니다.",
    time: "2시간 전",
    order: 120,
    asset: "Oracle Database 19c",
    owner: "박민수",
    status: "확인필요",
    read: false,
    link: { label: "패치 관리로 이동", view: "owner" },
  },
  {
    id: "N6",
    category: "asset",
    title: "SW 자산 담당자 변경",
    description: "Nginx 1.24.x 자산의 담당자가 이수민으로 변경되었습니다.",
    time: "3시간 전",
    order: 180,
    asset: "Nginx 1.24.x",
    owner: "이수민",
    status: "완료",
    read: false,
    link: { label: "자산 상세로 이동", view: "assets" },
  },
  {
    id: "N7",
    category: "asset",
    title: "SW 자산 버전 변경 감지",
    description: "PostgreSQL 자산 버전이 15.4에서 15.6으로 변경되었습니다.",
    time: "5시간 전",
    order: 300,
    asset: "PostgreSQL 15.6",
    owner: "박민수",
    status: "확인필요",
    read: true,
    link: { label: "자산 상세로 이동", view: "assets" },
  },
  {
    id: "N8",
    category: "security",
    title: "KISA 신규 취약점 공지 수집",
    description: "Log4j 관련 신규 CVE 공지 3건이 수집되었습니다.",
    time: "6시간 전",
    order: 360,
    asset: "Apache Log4j 2.x",
    owner: "정재율",
    status: "검토중",
    read: true,
    link: { label: "보안공지 관리로 이동", view: "kisa" },
  },
  {
    id: "N9",
    category: "system",
    title: "자동수집 실패 알림",
    description: "Red Hat Source URL 수집이 3회 연속 실패했습니다. 점검이 필요합니다.",
    time: "오늘 09:15",
    order: 420,
    asset: "Red Hat Enterprise Linux",
    owner: "관리자",
    status: "긴급",
    urgent: true,
    read: true,
    link: { label: "수집 로그 보기", view: "admin" },
  },
  {
    id: "N10",
    category: "eos",
    title: "CentOS 7 EOS 도래",
    description: "CentOS 7 자산의 EOS 일정이 30일 이내로 임박했습니다.",
    time: "오늘 08:40",
    order: 480,
    asset: "CentOS 7",
    owner: "김철수",
    status: "긴급",
    urgent: true,
    read: true,
    link: { label: "EOS 관리로 이동", view: "eos" },
  },
  {
    id: "N11",
    category: "system",
    title: "자동수집 스케줄러 정상 완료",
    description: "공식 Source URL 86개에 대한 정기 수집이 완료되었습니다.",
    time: "오늘 10:42",
    order: 45,
    asset: "전체",
    owner: "관리자",
    status: "완료",
    read: false,
    link: { label: "수집 로그 보기", view: "admin" },
  },
  {
    id: "N12",
    category: "system",
    title: "월간 자산관리 보고서 생성 완료",
    description: "2026년 6월 SW 자산관리 월간 보고서가 생성되었습니다.",
    time: "어제 18:00",
    order: 900,
    asset: "전체",
    owner: "관리자",
    status: "완료",
    read: true,
    link: { label: "수집 로그 보기", view: "admin" },
  },
]

type NotificationsContextValue = {
  notifications: Notification[]
  unreadCount: number
  urgentCount: number
  approvalCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(SEED)

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadCount = notifications.filter((n) => !n.read).length
    const urgentCount = notifications.filter((n) => n.urgent).length
    const approvalCount = notifications.filter(
      (n) => n.status === "승인대기",
    ).length
    return {
      notifications,
      unreadCount,
      urgentCount,
      approvalCount,
      markRead,
      markAllRead,
    }
  }, [notifications, markRead, markAllRead])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx)
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    )
  return ctx
}
