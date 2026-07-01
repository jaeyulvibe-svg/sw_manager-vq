"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ToastTone = "success" | "warning" | "danger" | "info"

type Toast = {
  id: number
  title: string
  description?: string
  tone: ToastTone
}

type ToastInput = Omit<Toast, "id">

const ToastContext = createContext<{
  toast: (t: ToastInput) => void
} | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

const toneStyles: Record<
  ToastTone,
  { icon: LucideIcon; ring: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: "border-success/40",
    iconColor: "text-success",
  },
  warning: {
    icon: AlertTriangle,
    ring: "border-warning/40",
    iconColor: "text-warning",
  },
  danger: {
    icon: ShieldAlert,
    ring: "border-destructive/50",
    iconColor: "text-destructive",
  },
  info: { icon: Info, ring: "border-primary/40", iconColor: "text-primary" },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (t: ToastInput) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => remove(id), 4200)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2.5">
        {toasts.map((t) => {
          const s = toneStyles[t.tone]
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "animate-toast glass glow-card pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 pr-9",
                s.ring,
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60",
                  s.iconColor,
                )}
              >
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {t.title}
                </p>
                {t.description ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                aria-label="닫기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* progress bar */}
              <span className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-xl bg-transparent">
                <span
                  className={cn(
                    "block h-full origin-left",
                    t.tone === "success" && "bg-success",
                    t.tone === "warning" && "bg-warning",
                    t.tone === "danger" && "bg-destructive",
                    t.tone === "info" && "bg-primary",
                  )}
                  style={{ animation: "shrink-x 4.2s linear forwards" }}
                />
              </span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
