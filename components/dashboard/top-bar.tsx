"use client"

import { ShieldCheck, Activity } from "lucide-react"

export function TopBar() {
  return (
    <header className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="glow-card flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            AI SW Asset Master
          </h1>
          <p className="text-sm text-muted-foreground">
            자산 기반 취약점 · 패치 · EOS 통합관리
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-success" />
          </span>
          <span className="text-xs font-medium text-success">
            AI 엔진 실시간 감시 중
          </span>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
          <Activity className="h-3.5 w-3.5 text-primary" />
          마지막 스캔 방금 전
        </div>
      </div>
    </header>
  )
}
