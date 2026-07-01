"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Boxes,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"
import { NAV_ITEMS, type ViewKey } from "./nav"
import { useRole } from "./role-context"
import { cn } from "@/lib/utils"

type CommandItem = {
  id: string
  label: string
  hint: string
  group: "이동" | "자산" | "취약점(CVE)"
  icon: LucideIcon
  target: ViewKey
  keywords?: string
}

const ASSET_ITEMS: CommandItem[] = [
  { id: "a1", label: "OpenSSL 3.0.x", hint: "SEC-PRD-01 · Critical", group: "자산", icon: Boxes, target: "assets", keywords: "openssl 보안 critical" },
  { id: "a2", label: "Oracle Database 19c", hint: "DB-PRD-01 · Critical", group: "자산", icon: Boxes, target: "assets", keywords: "oracle db database" },
  { id: "a3", label: "Apache Tomcat 9.0.89", hint: "WAS-PRD-01 · High", group: "자산", icon: Boxes, target: "assets", keywords: "tomcat apache was" },
  { id: "a4", label: "JEUS 7", hint: "WAS-PRD-02 · EOS 임박", group: "자산", icon: Boxes, target: "eos", keywords: "jeus tmax eos 단종" },
]

const CVE_ITEMS: CommandItem[] = [
  { id: "c1", label: "CVE-2026-0001", hint: "OpenSSL · CVSS 9.8", group: "취약점(CVE)", icon: ShieldAlert, target: "kisa", keywords: "openssl critical" },
  { id: "c2", label: "CVE-2026-0002", hint: "Apache Tomcat · CVSS 8.1", group: "취약점(CVE)", icon: ShieldAlert, target: "kisa", keywords: "tomcat high" },
  { id: "c3", label: "CVE-2026-0037", hint: "Oracle DB · CVSS 9.1", group: "취약점(CVE)", icon: ShieldAlert, target: "kisa", keywords: "oracle critical" },
]

export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (key: ViewKey) => void
}) {
  const { isAdmin } = useRole()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = NAV_ITEMS.filter(
      (n) => !n.adminOnly || isAdmin,
    ).map((n) => ({
      id: `nav-${n.key}`,
      label: n.label,
      hint: "페이지 이동",
      group: "이동",
      icon: n.icon,
      target: n.key,
      keywords: n.key,
    }))
    const all = [...navItems, ...ASSET_ITEMS, ...CVE_ITEMS]
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((it) =>
      [it.label, it.hint, it.keywords ?? ""].some((f) =>
        f.toLowerCase().includes(q),
      ),
    )
  }, [query, isAdmin])

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      const t = setTimeout(() => inputRef.current?.focus(), 40)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const groups = ["이동", "자산", "취약점(CVE)"] as const
  const flat = items

  const select = (item: CommandItem) => {
    onNavigate(item.target)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, flat.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = flat[active]
      if (item) select(item)
    } else if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    }
  }

  let runningIndex = -1

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="animate-overlay absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="빠른 검색"
        onKeyDown={onKeyDown}
        className="animate-palette conic-ring glass glow-card-strong relative w-full max-w-xl overflow-hidden rounded-2xl border border-border/60"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="자산, CVE, 메뉴 검색..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {'"'}
              {query}
              {'"'} 검색 결과가 없습니다.
            </p>
          ) : (
            groups.map((g) => {
              const groupItems = flat.filter((it) => it.group === g)
              if (groupItems.length === 0) return null
              return (
                <div key={g} className="mb-1">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g}
                  </p>
                  {groupItems.map((it) => {
                    runningIndex += 1
                    const idx = runningIndex
                    const isActive = idx === active
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => select(it)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-accent/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-background/50",
                          )}
                        >
                          <it.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {it.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {it.hint}
                          </span>
                        </span>
                        {isActive ? (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <ArrowDown className="h-3 w-3" />
              이동
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" />
              선택
            </span>
          </div>
          <span className="font-medium text-primary">AI SW Asset Master</span>
        </div>
      </div>
    </div>
  )
}
