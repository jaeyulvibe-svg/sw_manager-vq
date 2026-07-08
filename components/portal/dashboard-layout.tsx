"use client"

import { useEffect, useState, type ReactNode } from "react"
import { GripVertical, Lock, Unlock, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

/** Manages a persisted (localStorage) display order for a fixed set of block ids. */
export function useDashboardOrder(storageKey: string, blockIds: string[]) {
  const [order, setOrder] = useState<string[]>(blockIds)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (!stored) return
      const parsed: string[] = JSON.parse(stored)
      const sameSet =
        parsed.length === blockIds.length &&
        blockIds.every((id) => parsed.includes(id))
      if (sameSet) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOrder(parsed)
      }
    } catch {
      /* ignore malformed storage */
    }
    // storageKey/blockIds identity is stable per dashboard, only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function moveBefore(dragId: string, targetId: string) {
    if (dragId === targetId) return
    setOrder((prev) => {
      const next = prev.filter((id) => id !== dragId)
      const targetIdx = next.indexOf(targetId)
      next.splice(targetIdx, 0, dragId)
      window.localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  function reset() {
    setOrder(blockIds)
    window.localStorage.removeItem(storageKey)
  }

  return { order, moveBefore, reset }
}

/** Wraps a dashboard block with an (admin-only, unlocked-only) drag handle. */
export function DashboardSection({
  id,
  editable,
  draggingId,
  onDragStart,
  onDragOverTarget,
  onDrop,
  onDragEnd,
  children,
}: {
  id: string
  editable: boolean
  draggingId: string | null
  onDragStart: (id: string) => void
  onDragOverTarget: (id: string) => void
  onDrop: () => void
  onDragEnd: () => void
  children: ReactNode
}) {
  const isDragging = draggingId === id

  return (
    <div
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart(id)
      }}
      onDragOver={(e) => {
        if (!editable) return
        e.preventDefault()
        onDragOverTarget(id)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "relative transition-opacity",
        editable && "rounded-2xl outline-dashed outline-1 outline-offset-4 outline-primary/30",
        isDragging && "opacity-40",
      )}
    >
      {editable ? (
        <div
          className="absolute -left-3 -top-3 z-20 flex h-7 w-7 cursor-grab items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-lg active:cursor-grabbing"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function LockToggle({
  locked,
  onToggle,
  onReset,
}: {
  locked: boolean
  onToggle: () => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!locked}
        className={cn(
          "glow-card flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
          locked
            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-warning/50 bg-warning/15 text-warning",
        )}
      >
        {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        {locked ? "화면 편집 잠금" : "화면 편집 중"}
      </button>
      {!locked ? (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          배치 초기화
        </button>
      ) : null}
    </div>
  )
}
