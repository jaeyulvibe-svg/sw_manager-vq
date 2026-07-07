"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Boxes, ShieldAlert, Server, type LucideIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import type { Accent } from "./ui"
import type { ViewKey } from "./nav"

export type NotifCategory = "asset" | "security" | "system"

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
  asset: { label: "자산", icon: Boxes, accent: "primary" },
  security: { label: "보안", icon: ShieldAlert, accent: "destructive" },
  system: { label: "시스템", icon: Server, accent: "muted" },
}

export const STATUS_ACCENT: Record<NotifStatus, Accent> = {
  긴급: "destructive",
  승인대기: "primary",
  확인필요: "warning",
  검토중: "warning",
  완료: "success",
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return "방금 전"
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day === 1) return "어제"
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
}

function fromRow(row: Tables<"notifications">): Notification {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    time: formatRelative(row.created_at),
    order: -new Date(row.created_at).getTime(),
    asset: row.asset,
    owner: row.owner,
    status: row.status,
    urgent: row.urgent,
    read: row.read,
    link: { label: row.link_label, view: row.link_view as ViewKey },
  }
}

type NotificationsContextValue = {
  notifications: Notification[]
  loading: boolean
  unreadCount: number
  urgentCount: number
  approvalCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  refresh: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    const supabase = createClient()
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotifications(data.map(fromRow))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    createClient().from("notifications").update({ read: true }).eq("id", id).then()
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    createClient().from("notifications").update({ read: true }).eq("read", false).then()
  }, [])

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadCount = notifications.filter((n) => !n.read).length
    const urgentCount = notifications.filter((n) => n.urgent).length
    const approvalCount = notifications.filter(
      (n) => n.status === "승인대기",
    ).length
    return {
      notifications,
      loading,
      unreadCount,
      urgentCount,
      approvalCount,
      markRead,
      markAllRead,
      refresh,
    }
  }, [notifications, loading, markRead, markAllRead, refresh])

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
