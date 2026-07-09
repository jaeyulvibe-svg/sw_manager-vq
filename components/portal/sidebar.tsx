"use client"

import { ChevronsLeft, ChevronsRight, ShieldCheck, UserCog, X } from "lucide-react"
import { visibleNavItems, type ViewKey } from "./nav"
import { useRole, type Role } from "./role-context"
import { cn } from "@/lib/utils"

const CURRENT_USER: Record<Role, { name: string; label: string }> = {
  admin: { name: "김관리", label: "관리자" },
  owner: { name: "정재율", label: "사용자" },
}

export function Sidebar({
  active,
  onChange,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: {
  active: ViewKey
  onChange: (key: ViewKey) => void
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { role, isAdmin } = useRole()
  const items = visibleNavItems(isAdmin)
  const currentUser = CURRENT_USER[role]
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/60 bg-sidebar transition-[transform,width] duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-72 lg:w-[72px]" : "w-72",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-border/60 px-5 py-5",
            collapsed ? "lg:justify-center lg:px-0" : "justify-between",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="glow-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className={collapsed ? "lg:hidden" : undefined}>
              <h1 className="text-base font-bold leading-tight tracking-tight text-foreground">
                AI SW Asset Master
              </h1>
              <p className="text-[11px] leading-tight text-muted-foreground">
                자산 기반 취약점·패치·EOS 통합관리
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="메뉴 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          className={cn(
            "hidden items-center gap-2 border-b border-border/60 px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground lg:flex",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span>메뉴 접기</span>
            </>
          )}
        </button>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const isActive = item.key === active
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key)
                  onCloseMobile()
                }}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-primary/12 text-primary glow-card"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110",
                    isActive ? "text-primary" : "",
                  )}
                />
                <span className={cn("truncate text-left", collapsed && "lg:hidden")}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Footer status */}
        <div className="space-y-2.5 border-t border-border/60 px-4 py-4">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2",
              collapsed && "lg:justify-center lg:px-2",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              {isAdmin ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-xs font-semibold text-foreground">
                {currentUser.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {currentUser.label}로 접속 중
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2",
              collapsed && "lg:justify-center lg:px-2",
            )}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-success" />
            </span>
            <span className={cn("text-xs font-medium text-success", collapsed && "lg:hidden")}>
              AI 엔진 실시간 감시 중
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
