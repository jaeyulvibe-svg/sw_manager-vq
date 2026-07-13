"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { AnimatePresence, motion } from "framer-motion"
import { Eye, EyeOff, Lock, User, Loader2, CheckCircle2 } from "lucide-react"

import { loginSchema, type LoginSchema } from "@/lib/schema"
import { cn } from "@/lib/utils"

// zod의 safeParse 결과를 react-hook-form 리졸버 형식으로 변환한다
const loginResolver: Resolver<LoginSchema> = (values) => {
  const parsed = loginSchema.safeParse(values)
  if (parsed.success) {
    return { values: parsed.data, errors: {} }
  }
  const errors: Record<string, { type: string; message: string }> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0])
    if (!errors[key]) errors[key] = { type: issue.code, message: issue.message }
  }
  return { values: {}, errors }
}

const SPRING = {
  type: "spring" as const,
  stiffness: 130,
  damping: 15,
  mass: 1,
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: SPRING },
}

export function LoginForm({ onLogin }: { onLogin: (remember: boolean) => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  const form = useForm<LoginSchema>({
    resolver: loginResolver,
    defaultValues: { username: "", password: "" },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form

  // 데모용 로그인 — 실제 인증 없이 아이디/비밀번호만 채우면 통과시킨다
  async function onSubmit() {
    await new Promise((resolve) => setTimeout(resolve, 900))
    setSuccess(true)
    setTimeout(() => onLogin(true), 500)
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="w-full rounded-3xl border border-border bg-card/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
    >
      <motion.div variants={item} className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          로그인
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          계정에 로그인하여 통합관리 대시보드로 이동하세요.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Username */}
        <motion.div variants={item} className="flex flex-col gap-2">
          <label
            htmlFor="username"
            className="text-sm font-medium text-foreground/90"
          >
            아이디
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="아이디를 입력하세요"
              className={cn(
                "h-12 w-full rounded-xl border bg-secondary/40 pl-11 pr-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/30",
                errors.username ? "border-destructive" : "border-border",
              )}
              {...register("username")}
            />
          </div>
          <FieldError message={errors.username?.message} />
        </motion.div>

        {/* Password */}
        <motion.div variants={item} className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground/90"
          >
            비밀번호
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              className={cn(
                "h-12 w-full rounded-xl border bg-secondary/40 pl-11 pr-11 text-base text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/30",
                errors.password ? "border-destructive" : "border-border",
              )}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </motion.div>

        {/* Submit */}
        <motion.button
          variants={item}
          type="submit"
          disabled={isSubmitting || success}
          className={cn(
            "relative mt-2 flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-80",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {success ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="size-5" />
                로그인 성공
              </motion.span>
            ) : isSubmitting ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="size-5 animate-spin" />
                로그인 중...
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                로그인
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </form>
    </motion.div>
  )
}

function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-destructive"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
