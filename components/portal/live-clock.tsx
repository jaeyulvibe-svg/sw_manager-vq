"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function format(now: Date) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const w = WEEKDAYS[now.getDay()]
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  return {
    date: `${y}.${m}.${d} (${w})`,
    time: `${hh}:${mm}`,
  }
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Set the real time only after mount so SSR output (null) matches the
    // first client render, avoiding a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000 * 20)
    return () => clearInterval(id)
  }, [])

  const parts = now ? format(now) : { date: "----.--.--", time: "--:--" }

  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-border/70 bg-card px-3 py-1.5 glow-card xl:px-3.5">
      <Clock className="h-4 w-4 shrink-0 text-primary" />
      <div className="flex items-baseline gap-2">
        <span className="hidden text-xs text-muted-foreground xl:inline">{parts.date}</span>
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {parts.time}
        </span>
      </div>
    </div>
  )
}
