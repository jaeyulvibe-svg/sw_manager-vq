"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { GripVertical, Lock, Unlock, RotateCcw, ChevronUp, ChevronDown, EyeOff, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

type StoredLayout = { order: string[]; hidden: string[] }

function loadStoredLayout(storageKey: string, blockIds: string[]): StoredLayout | null {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    // Older versions stored a bare string[] order with no hidden list — treat that as hidden: [].
    const rawOrder: string[] = Array.isArray(parsed) ? parsed : (parsed?.order ?? [])
    const rawHidden: string[] = Array.isArray(parsed) ? [] : (parsed?.hidden ?? [])

    const kept = rawOrder.filter((id) => blockIds.includes(id))
    const missing = blockIds.filter((id) => !kept.includes(id))
    const order = [...kept, ...missing]
    if (order.length !== blockIds.length) return null

    const hidden = rawHidden.filter((id) => blockIds.includes(id))
    return { order, hidden }
  } catch {
    return null
  }
}

/** Manages a persisted (localStorage) display order + hidden set for a fixed set of block ids. */
export function useDashboardOrder(storageKey: string, blockIds: string[]) {
  const [order, setOrder] = useState<string[]>(blockIds)
  const [hidden, setHidden] = useState<string[]>([])

  useEffect(() => {
    const loaded = loadStoredLayout(storageKey, blockIds)
    if (loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrder(loaded.order)
      setHidden(loaded.hidden)
    }
    // storageKey/blockIds identity is stable per dashboard, only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist(nextOrder: string[], nextHidden: string[]) {
    window.localStorage.setItem(storageKey, JSON.stringify({ order: nextOrder, hidden: nextHidden }))
  }

  function moveBefore(dragId: string, targetId: string) {
    if (dragId === targetId) return
    setOrder((prev) => {
      const next = prev.filter((id) => id !== dragId)
      const targetIdx = next.indexOf(targetId)
      next.splice(targetIdx, 0, dragId)
      persist(next, hidden)
      return next
    })
  }

  // Swaps with the next *visible* neighbor, not just the adjacent array slot —
  // otherwise a hidden block sitting between two visible ones would silently
  // absorb the move instead of the button visibly reordering anything.
  function moveByOffset(id: string, direction: -1 | 1) {
    setOrder((prev) => {
      const index = prev.indexOf(id)
      let targetIndex = index + direction
      while (targetIndex >= 0 && targetIndex < prev.length && hidden.includes(prev[targetIndex])) {
        targetIndex += direction
      }
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      persist(next, hidden)
      return next
    })
  }

  function hideBlock(id: string) {
    setHidden((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      persist(order, next)
      return next
    })
  }

  function unhideBlock(id: string) {
    setHidden((prev) => {
      const next = prev.filter((h) => h !== id)
      persist(order, next)
      return next
    })
  }

  function reset() {
    setOrder(blockIds)
    setHidden([])
    window.localStorage.removeItem(storageKey)
  }

  return { order, hidden, moveBefore, moveByOffset, hideBlock, unhideBlock, reset }
}

/** Wraps a dashboard block with an (admin-only, unlocked-only) drag handle. */
export function DashboardSection({
  id,
  editable,
  draggingId,
  isOverTarget,
  isFirst,
  isLast,
  onDragStart,
  onDragOverTarget,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onHide,
  className,
  children,
}: {
  id: string
  editable: boolean
  draggingId: string | null
  isOverTarget: boolean
  isFirst: boolean
  isLast: boolean
  onDragStart: (id: string) => void
  onDragOverTarget: (id: string) => void
  onDrop: () => void
  onDragEnd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onHide?: () => void
  className?: string
  children: ReactNode
}) {
  const isDragging = draggingId === id

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className={className}
    >
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
          "relative rounded-2xl transition-colors duration-200",
          editable && "outline-dashed outline-1 outline-offset-4 outline-primary/30",
          isDragging && "opacity-40",
          isOverTarget && !isDragging && "bg-primary/10",
        )}
      >
        {editable ? (
          <div className="absolute -left-3 -top-3 z-20 flex items-center gap-1">
            <div
              className="flex h-7 w-7 cursor-grab items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-lg active:cursor-grabbing"
              aria-hidden
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              aria-label="위로 이동"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              aria-label="아래로 이동"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {onHide ? (
              <button
                type="button"
                onClick={onHide}
                aria-label="이 블록 숨기기"
                title="이 블록 숨기기"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-lg transition-colors hover:border-warning/50 hover:text-warning"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </motion.div>
  )
}

export function LockToggle({
  locked,
  onToggle,
  onReset,
  hidden = [],
  labels = {},
  onUnhide,
}: {
  locked: boolean
  onToggle: () => void
  onReset: () => void
  hidden?: string[]
  labels?: Record<string, string>
  onUnhide?: (id: string) => void
}) {
  const [hiddenMenuOpen, setHiddenMenuOpen] = useState(false)

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
      {!locked && onUnhide ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setHiddenMenuOpen((v) => !v)}
            disabled={hidden.length === 0}
            aria-expanded={hiddenMenuOpen}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="h-3.5 w-3.5" />
            숨긴 블록 {hidden.length > 0 ? `다시보기 (${hidden.length})` : "없음"}
          </button>
          {hiddenMenuOpen && hidden.length > 0 ? (
            <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-border/60 bg-card p-1.5 shadow-xl">
              {hidden.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onUnhide(id)
                    if (hidden.length === 1) setHiddenMenuOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent/60"
                >
                  <span className="truncate">{labels[id] ?? id}</span>
                  <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
