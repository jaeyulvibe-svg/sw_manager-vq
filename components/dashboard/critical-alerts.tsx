"use client"

import { AlertTriangle, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Severity = "critical" | "high" | "medium"

type Alert = {
  cve: string
  title: string
  asset: string
  severity: Severity
  score: number
  count: number
}

const alerts: Alert[] = [
  {
    cve: "CVE-2024-38112",
    title: "원격 코드 실행 취약점 (RCE)",
    asset: "Windows Server 2019 · 42대",
    severity: "critical",
    score: 9.8,
    count: 42,
  },
  {
    cve: "CVE-2024-21413",
    title: "인증 우회 및 권한 상승",
    asset: "MS Exchange · 8대",
    severity: "critical",
    score: 9.6,
    count: 8,
  },
  {
    cve: "CVE-2023-50164",
    title: "경로 조작 파일 업로드 취약점",
    asset: "Apache Struts · 15대",
    severity: "high",
    score: 8.4,
    count: 15,
  },
  {
    cve: "EOS-2024-011",
    title: "CentOS 7 지원 종료 (단종)",
    asset: "Linux Server · 63대",
    severity: "high",
    score: 7.9,
    count: 63,
  },
]

const severityStyles: Record<
  Severity,
  { badge: string; label: string; bar: string }
> = {
  critical: {
    badge: "bg-destructive/15 text-destructive border-destructive/40",
    label: "긴급",
    bar: "bg-destructive",
  },
  high: {
    badge: "bg-warning/15 text-warning border-warning/40",
    label: "높음",
    bar: "bg-warning",
  },
  medium: {
    badge: "bg-primary/15 text-primary border-primary/40",
    label: "보통",
    bar: "bg-primary",
  },
}

export function CriticalAlerts() {
  return (
    <div className="animate-soft-pulse flex h-full flex-col rounded-2xl border border-destructive/30 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">
              즉시 조치 필요 (Critical)
            </h3>
            <p className="text-xs text-muted-foreground">
              CVSS 기준 위험도 상위 알림
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-destructive" />
          LIVE
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-3">
        {alerts.map((alert) => {
          const s = severityStyles[alert.severity]
          return (
            <li
              key={alert.cve}
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
                  {alert.asset}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-lg font-bold tabular-nums text-destructive">
                  {alert.score.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">
                  CVSS
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-destructive" />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
