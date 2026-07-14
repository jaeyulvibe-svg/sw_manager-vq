"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ShieldCheck, UserCog } from "lucide-react"
import { useRole } from "./role-context"
import { StatusBadge, type Accent } from "./ui"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/supabase/types"

const ROLE_ACCENT: Record<Tables<"app_users">["role"], Accent> = {
  관리자: "primary",
  담당자: "success",
  "조회 사용자": "muted",
}

export function UserSwitcher() {
  const { currentUser, users, isAdmin, setCurrentUserId } = useRole()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const Icon = isAdmin ? ShieldCheck : UserCog

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!currentUser}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors xl:px-3",
          open && "border-primary/50",
          !currentUser && "opacity-60",
        )}
        aria-label="로그인 사용자 전환"
        aria-expanded={open}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="hidden xl:inline">
          {currentUser ? `${currentUser.name} · ${currentUser.role}` : "불러오는 중…"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="animate-palette absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
          <div className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            로그인 사용자 전환 (데모)
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {users.map((user) => {
              const selected = user.id === currentUser?.id
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setCurrentUserId(user.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-border/40 px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/40",
                    selected && "bg-primary/[0.06]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.dept}</p>
                  </div>
                  <StatusBadge accent={ROLE_ACCENT[user.role]}>{user.role}</StatusBadge>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              )
            })}
            {users.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                등록된 사용자가 없습니다.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
