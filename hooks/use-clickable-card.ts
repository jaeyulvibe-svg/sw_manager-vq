import type { KeyboardEvent } from "react"

// Shared a11y wiring for cards that act as a button when an onClick is provided
// (StatCard, KpiCard) — keeps role/tabIndex/onKeyDown/className in lockstep across both.
export function useClickableCard(onClick?: () => void) {
  if (!onClick) {
    return {
      role: undefined,
      tabIndex: undefined,
      onClick: undefined,
      onKeyDown: undefined,
      clickableClassName: undefined,
    } as const
  }

  return {
    role: "button" as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onClick()
      }
    },
    clickableClassName: "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
  } as const
}
