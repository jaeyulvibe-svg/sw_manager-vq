"use client"

import { ShieldCheck, X } from "lucide-react"
import { visibleNavItems, type ViewKey } from "./nav"
import { useRole } from "./role-context"
import { cn } from "@/lib/utils"

export function Sidebar({
  active,
  onChange,
  mobileOpen,
  onCloseMobile,
}: {
  active: ViewKey
  onChange: (key: ViewKey) => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { isAdmin } = useRole()
  const items = visibleNavItems(isAdmin)
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
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/60 bg-sidebar transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="glow-card flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
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
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
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
                <span className="truncate text-left">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer status */}
        <div className="border-t border-border/60 px-4 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-success" />
            </span>
            <span className="text-xs font-medium text-success">
              AI 엔진 실시간 감시 중
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
