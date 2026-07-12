"use client"

import { motion } from "framer-motion"
import { LoginBackground } from "./login-background"
import { LoginForm } from "./login-form"

const DURATION = 0.3
const EASE_OUT = "easeOut"

export function LoginView({ onLogin }: { onLogin: (remember: boolean) => void }) {
  return (
    <main className="relative h-[100dvh] w-full p-[var(--inset)]">
      <div className="relative h-full w-full overflow-hidden rounded-[42px] md:rounded-[72px]">
        <LoginBackground src="/alt.mp4" placeholder="/alt-placeholder.png" />
        {/* 텍스트가 있는 오른쪽을 더 어둡게 눌러 영상 위에서도 가독성을 확보 */}
        <div className="absolute inset-0 bg-gradient-to-l from-background/80 via-background/45 to-transparent" />
        {/* 전체적으로 살짝 더 어둡게 */}
        <div className="absolute inset-0 bg-background/20" />

        <div className="relative flex h-full w-full overflow-hidden flex-col items-end justify-center gap-6 px-sides pr-8 pt-10 short:lg:gap-6 short:lg:pt-10 sm:pr-16 lg:gap-8 lg:pr-24">
          {/* Brand heading — 영상 위에서도 읽히도록 반투명 패널로 감싼다 */}
          <motion.div
            layout="position"
            transition={{ duration: DURATION, ease: EASE_OUT }}
            className="flex flex-col items-end gap-4 rounded-3xl border border-border/40 bg-background/50 px-6 py-5 text-right shadow-xl shadow-black/20 backdrop-blur-md sm:px-8 sm:py-6"
          >
            <motion.span
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION, ease: EASE_OUT }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/15 px-4 py-1.5 text-xs font-semibold text-blue-300 backdrop-blur-md sm:text-sm"
            >
              <span className="size-1.5 rounded-full bg-blue-400" />
              SW 자산 · 취약점 · 패치 · EOS 통합관리 플랫폼
            </motion.span>

            <motion.h1
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION, ease: EASE_OUT, delay: 0.05 }}
              className="text-balance text-4xl font-bold tracking-tight text-foreground drop-shadow-lg sm:text-5xl lg:text-6xl"
            >
              AI SW 관리{" "}
              <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent drop-shadow-lg">
                Master
              </span>
            </motion.h1>

            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION, ease: EASE_OUT, delay: 0.1 }}
              className="max-w-md text-pretty text-sm font-medium leading-relaxed text-foreground/80 drop-shadow italic sm:text-base"
            >
              농협정보시스템
            </motion.p>
          </motion.div>

          {/* Login form card */}
          <motion.div
            layout="position"
            transition={{ duration: DURATION, ease: EASE_OUT }}
            className="flex min-h-0 w-full shrink justify-end"
          >
            <LoginForm onLogin={onLogin} />
          </motion.div>
        </div>
      </div>
    </main>
  )
}
