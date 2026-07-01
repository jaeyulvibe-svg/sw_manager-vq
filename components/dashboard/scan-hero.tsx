"use client"

import { Radar, Cpu, Boxes } from "lucide-react"

export function ScanHero() {
  return (
    <section className="animate-rise relative overflow-hidden rounded-2xl border border-primary/25 bg-card animate-glow-breathe">
      {/* Animated grid backdrop */}
      <div className="hero-grid absolute inset-0 opacity-60" aria-hidden />
      {/* Scanning sweep line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 animate-scan-sweep bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" aria-hidden />
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Cpu className="h-3.5 w-3.5" />
            AI 자산 스캐닝 엔진 가동 중
          </div>
          <h2 className="text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            전사 소프트웨어 자산을{" "}
            <span className="text-primary text-glow">실시간 분석</span>하여
            위협을 식별합니다
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            취약점(CVE), 패치 적용 현황, 단종(EOS) 소프트웨어를 하나의 화면에서
            통합 관리합니다.
          </p>
        </div>

        {/* Radar visual */}
        <div className="relative mx-auto grid h-44 w-44 shrink-0 place-items-center sm:h-52 sm:w-52">
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <div className="absolute inset-4 rounded-full border border-primary/20" />
          <div className="absolute inset-8 rounded-full border border-primary/20" />
          <div className="absolute inset-12 rounded-full border border-primary/25" />
          {/* Sweep */}
          <div className="animate-radar absolute inset-0 rounded-full">
            <div
              className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left rounded-tr-full bg-gradient-to-tr from-primary/40 to-transparent"
              aria-hidden
            />
          </div>
          <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary glow-card-strong">
            <Radar className="h-8 w-8" />
          </div>
          {/* Blips */}
          <span className="animate-blink absolute left-[30%] top-[35%] h-2 w-2 rounded-full bg-success" />
          <span className="animate-blink absolute right-[28%] top-[55%] h-2 w-2 rounded-full bg-warning [animation-delay:0.4s]" />
          <span className="animate-blink absolute left-[42%] bottom-[26%] h-2 w-2 rounded-full bg-destructive [animation-delay:0.8s]" />
        </div>
      </div>

      <div className="relative flex items-center gap-2 border-t border-border/60 px-6 py-3 text-xs text-muted-foreground sm:px-8">
        <Boxes className="h-4 w-4 text-primary" />
        전체 자산 인벤토리 자동 동기화 · 클라우드 / 온프레미스 / 엔드포인트
      </div>
    </section>
  )
}
