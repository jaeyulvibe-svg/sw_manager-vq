"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronsLeft, ChevronsRight, ShieldCheck, UserCog, X } from "lucide-react"
import { visibleNavItems, isNavGroup, type ViewKey } from "./nav"
import { useRole } from "./role-context"
import { cn } from "@/lib/utils"

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
  const { currentUser, isAdmin } = useRole()
  const items = visibleNavItems(isAdmin)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const groupRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 활성 뷰가 속한 그룹은 항상 펼쳐진 상태를 유지
  useEffect(() => {
    const group = items.find((entry) => isNavGroup(entry) && entry.children.some((c) => c.key === active))
    if (group && isNavGroup(group) && !openGroups.has(group.groupKey)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenGroups((prev) => new Set(prev).add(group.groupKey))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // 그룹이 펼쳐지면 하위 메뉴가 스크롤 영역 아래로 잘리지 않도록 자동으로 스크롤
  useEffect(() => {
    openGroups.forEach((key) => {
      groupRefs.current.get(key)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    })
  }, [openGroups])

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(0,82,180,0.28),transparent_42%),linear-gradient(180deg,#061B3A_0%,#04142C_48%,#031128_100%)] transition-[transform,width] duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-72 lg:w-[72px]" : "w-72",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-white/10 bg-black/10 px-5 py-5",
            collapsed ? "lg:justify-center lg:px-0" : "justify-between",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="glow-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className={collapsed ? "lg:hidden" : undefined}>
              <h1 className="text-base font-bold leading-tight tracking-tight text-white">
                AI SW관리 Master
              </h1>
              <p className="text-[11px] leading-tight text-slate-300/80">
                자산 기반 취약점·패치·EOS 통합관리
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="text-slate-300 hover:text-white lg:hidden"
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
            "hidden items-center gap-2 border-b border-white/10 px-5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:flex",
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
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-none px-3 py-4">
          {items.map((entry) => {
            if (isNavGroup(entry)) {
              const expanded = openGroups.has(entry.groupKey)
              const groupActive = entry.children.some((c) => c.key === active)
              return (
                <div
                  key={entry.groupKey}
                  ref={(el) => {
                    if (el) groupRefs.current.set(entry.groupKey, el)
                    else groupRefs.current.delete(entry.groupKey)
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed) {
                        onChange(entry.children[0].key)
                        onCloseMobile()
                      } else {
                        toggleGroup(entry.groupKey)
                      }
                    }}
                    aria-expanded={expanded}
                    title={collapsed ? entry.label : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      collapsed && "lg:justify-center lg:px-0",
                      groupActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <entry.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110",
                        groupActive ? "text-white" : "",
                      )}
                    />
                    <span className={cn("min-w-0 flex-1 truncate text-left", collapsed && "lg:hidden")}>
                      {entry.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-300 transition-transform",
                        expanded && "rotate-180",
                        collapsed && "lg:hidden",
                      )}
                    />
                  </button>

                  {expanded ? (
                    <div className={cn("ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-3", collapsed && "lg:hidden")}>
                      {entry.children.map((child) => {
                        const isActive = child.key === active
                        return (
                          <button
                            key={child.key}
                            type="button"
                            onClick={() => {
                              onChange(child.key)
                              onCloseMobile()
                            }}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                              isActive
                                ? "bg-blue-600 text-white"
                                : "text-slate-300 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            {child.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            }

            const isActive = entry.key === active
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  onChange(entry.key)
                  onCloseMobile()
                }}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? entry.label : undefined}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-blue-600 text-white glow-card"
                    : "text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-300" />
                ) : null}
                <entry.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110",
                    isActive ? "text-white" : "",
                  )}
                />
                <span className={cn("truncate text-left", collapsed && "lg:hidden")}>
                  {entry.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Footer status */}
        <div className="space-y-2.5 border-t border-white/10 px-4 py-4">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2",
              collapsed && "lg:justify-center lg:px-2",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-200">
              {isAdmin ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <UserCog className="h-4 w-4" />
              )}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-xs font-semibold text-white">
                {currentUser?.name ?? "-"}
              </p>
              <p className="truncate text-[11px] text-slate-300/80">
                {currentUser ? `${currentUser.role}로 접속 중` : "불러오는 중…"}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2",
              collapsed && "lg:justify-center lg:px-2",
            )}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-emerald-400" />
            </span>
            <span className={cn("text-xs font-medium text-emerald-400", collapsed && "lg:hidden")}>
              AI 엔진 실시간 감시 중
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
