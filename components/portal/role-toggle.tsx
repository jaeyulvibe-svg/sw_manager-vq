"use client"

import { ShieldCheck, UserCog } from "lucide-react"
import { useRole } from "./role-context"
import { cn } from "@/lib/utils"

export function RoleToggle() {
  const { role, setRole } = useRole()

  return (
    <div
      className="flex items-center rounded-full border border-border/70 bg-card p-0.5"
      role="group"
      aria-label="사용자 모드 전환"
    >
      <button
        type="button"
        onClick={() => setRole("admin")}
        aria-pressed={role === "admin"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
          role === "admin"
            ? "bg-primary/20 text-primary glow-card"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        관리자 모드
      </button>
      <button
        type="button"
        onClick={() => setRole("owner")}
        aria-pressed={role === "owner"}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
          role === "owner"
            ? "bg-eos/20 text-eos glow-card"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <UserCog className="h-3.5 w-3.5" />
        담당자 모드
      </button>
    </div>
  )
}
