"use client"

import { motion } from "framer-motion"
import { LoginBackground } from "./login-background"
import { LoginForm } from "./login-form"

const DURATION = 0.3
const EASE_OUT = "easeOut"

export function LoginView({ onLogin }: { onLogin: (remember: boolean) => void }) {
  return (
    <main className="dark relative h-[100dvh] w-full p-[var(--inset)]">
      <div className="relative flex h-full w-full overflow-hidden rounded-[42px] md:rounded-[72px]">
        {/* 왼쪽: 배경 영상 */}
        <div className="relative hidden h-full w-1/2 overflow-hidden md:block">
          <LoginBackground src="/alt.mp4" placeholder="/alt-placeholder.png" />
          {/* 영상이 너무 밝지 않도록 살짝 눌러준다 */}
          <div className="pointer-events-none absolute inset-0 bg-background/10" />
          {/* 오른쪽 패널로 부드럽게 이어지도록 페이드 */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/80" />
        </div>

        {/* 오른쪽: 타이틀 + 로그인 폼 */}
        <div className="relative h-full flex-1 overflow-hidden bg-background">
          {/* 장식용 배경 레이어 */}
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
          <div className="pointer-events-none absolute -left-24 top-1/4 size-[28rem] rounded-full bg-primary/25 blur-3xl aurora-blob" />
          <div className="aurora-blob-slow pointer-events-none absolute bottom-0 right-0 size-[24rem] rounded-full bg-sky-500/15 blur-3xl aurora-blob" />
          {/* 영상 쪽 경계와 자연스럽게 이어지는 페이드 */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-background to-transparent" />

          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 overflow-y-auto px-8 py-10">
            <div className="flex w-[26rem] max-w-full flex-col items-end gap-8">
              {/* Brand heading */}
              <motion.div
                layout="position"
                transition={{ duration: DURATION, ease: EASE_OUT }}
                className="flex w-full flex-col items-end gap-4 text-right"
              >
                <motion.span
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION, ease: EASE_OUT }}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-md sm:text-sm"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  SW 자산 · 취약점 · 패치 · EOS 통합관리 플랫폼
                </motion.span>

                <motion.h1
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION, ease: EASE_OUT, delay: 0.05 }}
                  className="break-keep text-balance text-4xl font-bold tracking-tight text-foreground drop-shadow-lg sm:text-5xl"
                >
                  AI SW 관리{" "}
                  <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">
                    Master
                  </span>
                </motion.h1>

                <motion.p
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION, ease: EASE_OUT, delay: 0.1 }}
                  className="max-w-md text-pretty text-sm font-medium italic leading-relaxed text-foreground/80 drop-shadow sm:text-base"
                >
                  농협정보시스템
                </motion.p>
              </motion.div>

              {/* Login form card */}
              <motion.div
                layout="position"
                transition={{ duration: DURATION, ease: EASE_OUT }}
                className="flex w-full justify-end"
              >
                <LoginForm onLogin={onLogin} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
