"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "theme"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    // Read the persisted/DOM theme after mount only, so the first client
    // render matches the server-rendered HTML and avoids a hydration mismatch.
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const next =
      stored === "dark" || stored === "light"
        ? stored
        : document.documentElement.classList.contains("dark")
          ? "dark"
          : "light"
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(next)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggleTheme: () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
