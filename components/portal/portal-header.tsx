"use client"

import { LogOut, Menu, Search } from "lucide-react"
import { LiveClock } from "./live-clock"
import { RoleToggle } from "./role-toggle"
import { ThemeToggle } from "./theme-toggle"
import { NotificationBell } from "./notification-bell"
import { NAV_ITEMS, EXTRA_VIEW_META, isNavGroup, type ViewKey } from "./nav"

export function PortalHeader({
  active,
  onOpenMobile,
  onOpenPalette,
  onNavigate,
  onOpenNotifications,
  onLogout,
}: {
  active: ViewKey
  onOpenMobile: () => void
  onOpenPalette: () => void
  onNavigate: (view: ViewKey) => void
  onOpenNotifications: () => void
  onLogout: () => void
}) {
  const current =
    NAV_ITEMS.flatMap((entry) => (isNavGroup(entry) ? entry.children : [entry])).find(
      (n) => n.key === active,
    ) ?? EXTRA_VIEW_META[active]

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground lg:hidden"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          {current ? (
            <current.icon className="h-4 w-4 text-primary" />
          ) : null}
          <span className="text-sm font-semibold text-foreground">
            {current?.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="빠른 검색 열기"
        >
          <Search className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
          <span className="hidden sm:inline">검색</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] sm:flex">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>
        <RoleToggle />
        <ThemeToggle />
        <NotificationBell
          onNavigate={onNavigate}
          onOpenCenter={onOpenNotifications}
        />
        <LiveClock />
        <button
          type="button"
          onClick={onLogout}
          aria-label="로그아웃"
          title="로그아웃"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
