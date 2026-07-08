"use client"

import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useCountUp } from "@/hooks/use-count-up"
import { cn } from "@/lib/utils"

/* ---------------- Page header ---------------- */

export function PageHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description: string
  icon: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="glow-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ---------------- Accent system ---------------- */

export type Accent =
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "eos"
  | "muted"

const accentText: Record<Accent, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  eos: "text-eos",
  muted: "text-muted-foreground",
}

const accentSoft: Record<Accent, string> = {
  primary: "bg-primary/12 text-primary border-primary/40",
  success: "bg-success/12 text-success border-success/40",
  warning: "bg-warning/15 text-warning border-warning/40",
  destructive: "bg-destructive/15 text-destructive border-destructive/40",
  eos: "bg-eos/15 text-eos border-eos/40",
  muted: "bg-muted/60 text-muted-foreground border-border/60",
}

const barColor: Record<Accent, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  eos: "bg-eos",
  muted: "bg-muted-foreground",
}

/* ---------------- Status badge ---------------- */

export function StatusBadge({
  children,
  accent = "muted",
  pulse = false,
  className,
}: {
  children: React.ReactNode
  accent?: Accent
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold",
        accentSoft[accent],
        pulse && "animate-soft-pulse",
        className,
      )}
    >
      {pulse ? (
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  )
}

/* ---------------- Progress bar ---------------- */

export function ProgressBar({
  value,
  accent = "primary",
  className,
}: {
  value: number
  accent?: Accent
  className?: string
}) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted/70",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", barColor[accent])}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  )
}

/* ---------------- KPI stat card (count-up) ---------------- */

export function StatCard({
  label,
  value,
  suffix,
  decimals = 0,
  icon: Icon,
  accent = "primary",
  trend,
  trendLabel,
  delay = 0,
}: {
  label: string
  value: number
  suffix?: string
  decimals?: number
  icon: LucideIcon
  accent?: Accent
  trend?: number
  trendLabel?: string
  delay?: number
}) {
  const animated = useCountUp(value, { decimals, delay, duration: 1600 })
  const positive = (trend ?? 0) >= 0
  const TrendIcon = positive ? TrendingUp : TrendingDown

  return (
    <div
      className="glow-card animate-rise group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-transform duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 hidden h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 dark:block dark:opacity-70"
        aria-hidden
      />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border",
            accentSoft[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {animated.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix ? <span className="text-xl sm:text-2xl">{suffix}</span> : null}
      </div>
      {trend !== undefined || trendLabel ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {trend !== undefined ? (
            <span
              className={cn(
                "flex items-center gap-1 font-semibold",
                positive ? "text-success" : "text-destructive",
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(trend)}%
            </span>
          ) : null}
          {trendLabel ? (
            <span className="text-muted-foreground">{trendLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- Section card ---------------- */

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "glow-card animate-rise flex flex-col rounded-2xl border border-border/60 bg-card p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

/* ---------------- Table shell ---------------- */

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full min-w-max border-collapse text-sm">
        {children}
      </table>
    </div>
  )
}

export function Th({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-border/60 bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap border-b border-border/40 px-3 py-2.5 text-foreground",
        className,
      )}
    >
      {children}
    </td>
  )
}

/* ---------------- Small action button ---------------- */

export function MiniButton({
  children,
  accent = "muted",
  onClick,
  disabled = false,
}: {
  children: React.ReactNode
  accent?: Accent
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:brightness-125",
        disabled ? "cursor-not-allowed opacity-50 hover:brightness-100" : undefined,
        accentSoft[accent],
      )}
    >
      {children}
    </button>
  )
}
