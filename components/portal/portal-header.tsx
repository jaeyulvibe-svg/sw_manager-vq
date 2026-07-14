"use client"

import { LogOut, Menu, Search } from "lucide-react"
import { LiveClock } from "./live-clock"
import { UserSwitcher } from "./user-switcher"
import { ThemeToggle } from "./theme-toggle"
import { NotificationBell } from "./notification-bell"
import type { LucideIcon } from "lucide-react"
import { NAV_ITEMS, isNavGroup, type ViewKey } from "./nav"

/** Returns the top-level nav entry for a view: its parent group if nested, or itself. */
function topLevelEntryFor(active: ViewKey): { label: string; icon: LucideIcon } | undefined {
  for (const entry of NAV_ITEMS) {
    if (isNavGroup(entry)) {
      if (entry.children.some((c) => c.key === active)) {
        return { label: entry.label, icon: entry.icon }
      }
    } else if (entry.key === active) {
      return { label: entry.label, icon: entry.icon }
    }
  }
  return undefined
}

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
  const current = topLevelEntryFor(active)

  return (
    <header className="sticky top-0 z-30 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground lg:hidden"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          {current ? (
            <current.icon className="h-4 w-4 shrink-0 text-primary" />
          ) : null}
          <span className="truncate text-sm font-semibold text-foreground">
            {current?.label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 gap-y-2 sm:gap-2.5">
        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="빠른 검색 열기"
        >
          <Search className="h-3.5 w-3.5 shrink-0 transition-colors group-hover:text-primary" />
          <span className="hidden xl:inline">검색</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] xl:flex">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>
        <UserSwitcher />
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
