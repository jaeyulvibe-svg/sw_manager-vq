"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "밝은 화면으로 전환" : "어두운 화면으로 전환"}
      aria-pressed={isDark}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
