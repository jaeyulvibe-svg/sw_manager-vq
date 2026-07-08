"use client"

import { AlertTriangle, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/supabase/types"
import { matchAssets } from "@/lib/vuln-match"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">

const severityStyles: Record<
  string,
  { badge: string; label: string; bar: string }
> = {
  Critical: {
    badge: "bg-destructive/15 text-destructive border-destructive/40",
    label: "긴급",
    bar: "bg-destructive",
  },
  High: {
    badge: "bg-warning/15 text-warning border-warning/40",
    label: "높음",
    bar: "bg-warning",
  },
}

export function CriticalAlerts({
  assets,
  vulns,
}: {
  assets: Asset[]
  vulns: Vulnerability[]
}) {
  const alerts = vulns
    .filter((v) => v.severity === "Critical" || v.severity === "High")
    .map((v) => ({ ...v, mappedCount: matchAssets(v, assets).length }))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "Critical" ? -1 : 1))

  return (
    <div className="animate-soft-pulse flex h-full flex-col rounded-2xl border border-destructive/30 bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-foreground">
              즉시 조치 필요 (Critical)
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              CVSS 기준 위험도 상위 알림
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-destructive" />
          LIVE
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-3">
        {alerts.length === 0 ? (
          <li className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            현재 긴급 대응이 필요한 취약점 공지가 없습니다.
          </li>
        ) : (
          alerts.map((alert) => {
            const s = severityStyles[alert.severity] ?? severityStyles.High
            return (
              <li
                key={alert.id}
                className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-destructive/40"
              >
                <span className={cn("h-11 w-1 rounded-full", s.bar)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        s.badge,
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {alert.cve}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {alert.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {alert.product} · 영향 자산 {alert.mappedCount}대
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-destructive" />
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
