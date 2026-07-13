"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, Check, CheckCheck, ArrowRight, X } from "lucide-react"
import {
  useNotifications,
  CATEGORY_META,
  STATUS_RISK,
  type Notification,
} from "./notifications-context"
import { StatusBadge, riskText, type RiskLevel } from "./ui"
import { type ViewKey } from "./nav"
import { cn } from "@/lib/utils"

type FilterKey = "all" | "unread" | "urgent"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unread", label: "읽지 않음" },
  { key: "urgent", label: "긴급" },
]

function matchesFilter(n: Notification, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true
    case "unread":
      return !n.read
    case "urgent":
      return !!n.urgent
  }
}

export function NotificationBell({
  onNavigate,
  onOpenCenter,
}: {
  onNavigate: (view: ViewKey) => void
  onOpenCenter: () => void
}) {
  const { notifications, unreadCount, urgentCount, markRead, markAllRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterKey>("all")
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const filtered = notifications
    .filter((n) => matchesFilter(n, filter))
    .sort((a, b) => a.order - b.order)

  const summary: { label: string; value: number; risk?: RiskLevel }[] = [
    { label: "전체 알림", value: notifications.length },
    { label: "읽지 않음", value: unreadCount, risk: 3 },
    { label: "긴급", value: urgentCount, risk: 5 },
  ]

  const handleGo = (n: Notification) => {
    markRead(n.id)
    onNavigate(n.link.view)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground transition-colors hover:text-foreground",
          open && "border-primary/50 text-foreground",
        )}
        aria-label={`알림 ${unreadCount}건 읽지 않음`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-palette absolute right-0 top-11 z-50 w-[min(92vw,26rem)] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">알림 센터</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              aria-label="닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-px border-b border-border/60 bg-border/60">
            {summary.map((s) => (
              <div key={s.label} className="bg-card px-2 py-2.5 text-center">
                <div
                  className={cn(
                    "font-mono text-lg font-bold tabular-nums",
                    s.risk ? riskText[s.risk] : "text-primary",
                  )}
                >
                  {s.value}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-border/60 px-3 py-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[22rem] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                해당 조건의 알림이 없습니다.
              </div>
            ) : (
              filtered.map((n) => {
                const meta = CATEGORY_META[n.category]
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative flex gap-3 border-b border-border/40 px-4 py-3 transition-colors hover:bg-accent/40",
                      !n.read && "bg-primary/[0.04]",
                    )}
                  >
                    {!n.read ? (
                      <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />
                    ) : null}
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.accent === "primary" &&
                          "border-primary/40 bg-primary/12 text-primary",
                        meta.accent === "eos" &&
                          "border-eos/40 bg-eos/15 text-eos",
                        meta.accent === "warning" &&
                          "border-warning/40 bg-warning/15 text-warning",
                        meta.accent === "destructive" &&
                          "border-destructive/40 bg-destructive/15 text-destructive",
                        meta.accent === "muted" &&
                          "border-border/60 bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge accent={meta.accent}>
                          {meta.label}
                        </StatusBadge>
                        <StatusBadge
                          risk={STATUS_RISK[n.status]}
                          pulse={n.status === "긴급"}
                        >
                          {n.status}
                        </StatusBadge>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {n.time}
                        </span>
                      </div>
                      <p className="mt-1 text-pretty text-sm font-semibold text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {n.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          자산{" "}
                          <span className="font-medium text-foreground">
                            {n.asset}
                          </span>
                        </span>
                        <span>
                          담당{" "}
                          <span className="font-medium text-foreground">
                            {n.owner}
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGo(n)}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/12 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          {n.link.label}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                        {!n.read ? (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Check className="h-3 w-3" />
                            읽음
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t border-border/60 p-3">
            <button
              type="button"
              onClick={() => {
                onOpenCenter()
                setOpen(false)
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent/60"
            >
              전체 알림 보기
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={markAllRead}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/12 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              전체 읽음 처리
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
