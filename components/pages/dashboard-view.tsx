"use client"

import { useEffect, useState } from "react"
import { History, Boxes, ShieldCheck } from "lucide-react"
import { AssetDashboardView } from "@/components/pages/asset-dashboard-view"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { ScanHero } from "@/components/dashboard/scan-hero"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { CriticalAlerts } from "@/components/dashboard/critical-alerts"
import {
  VulnerabilityApprovalStatus,
  SeverityDonut,
} from "@/components/dashboard/charts"
import {
  NoticeBoard,
  SecurityNoticeBoard,
} from "@/components/dashboard/notice-boards"
import { SectionCard, type Accent } from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import type { ViewKey } from "@/components/portal/nav"
import {
  useDashboardOrder,
  DashboardSection,
  LockToggle,
} from "@/components/portal/dashboard-layout"
import {
  useNotifications,
  CATEGORY_META,
} from "@/components/portal/notifications-context"

type Asset = Tables<"assets">
type Vulnerability = Tables<"vulnerabilities">

const accentIconColor: Record<Accent, string> = {
  primary: "text-primary",
  destructive: "text-destructive",
  warning: "text-warning",
  yellow: "text-yellow",
  success: "text-success",
  eos: "text-eos",
  muted: "text-muted-foreground",
}

function RecentUpdates() {
  const { notifications, loading } = useNotifications()
  const recent = notifications.slice(0, 5)

  return (
    <SectionCard
      title="최근 업데이트 내역"
      subtitle="자산·취약점·패치 실시간 활동 로그"
      icon={History}
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          최근 활동 내역이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col">
          {recent.map((n, i) => {
            const meta = CATEGORY_META[n.category]
            return (
              <li key={n.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i !== recent.length - 1 ? (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-border/60" />
                ) : null}
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                  <meta.icon className={cn("h-4 w-4", accentIconColor[meta.accent])} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {n.time}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {n.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

const SECURITY_DASHBOARD_BLOCKS = ["hero", "kpi", "charts", "alerts", "notices", "security-notices"]

function SecurityDashboardView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useRole()
  const [locked, setLocked] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const { order, moveBefore, moveByOffset, reset } = useDashboardOrder(
    "security-dashboard-order",
    SECURITY_DASHBOARD_BLOCKS,
  )

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("vulnerabilities").select("*").order("collected_at", { ascending: false }),
    ]).then(([assetsRes, vulnsRes]) => {
      if (assetsRes.data) setAssets(assetsRes.data)
      if (vulnsRes.data) setVulns(vulnsRes.data)
      setLoading(false)
    })
  }, [])

  const editable = isAdmin && !locked

  const blocks: Record<string, React.ReactNode> = {
    hero: <ScanHero />,
    kpi: <KpiCards assets={assets} loading={loading} />,
    charts: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <VulnerabilityApprovalStatus vulns={vulns} />
        <SeverityDonut assets={assets} />
      </div>
    ),
    alerts: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CriticalAlerts assets={assets} vulns={vulns} />
        <RecentUpdates />
      </div>
    ),
    notices: <NoticeBoard onNavigate={onNavigate} />,
    "security-notices": <SecurityNoticeBoard assets={assets} vulns={vulns} />,
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin ? (
        <div className="flex justify-end">
          <LockToggle
            locked={locked}
            onToggle={() => setLocked((v) => !v)}
            onReset={reset}
          />
        </div>
      ) : null}

      {order.map((id, index) => (
        <DashboardSection
          key={id}
          id={id}
          editable={editable}
          draggingId={draggingId}
          isOverTarget={overId === id}
          isFirst={index === 0}
          isLast={index === order.length - 1}
          onDragStart={setDraggingId}
          onDragOverTarget={(targetId) => {
            setOverId(targetId)
            if (draggingId && draggingId !== targetId) moveBefore(draggingId, targetId)
          }}
          onDrop={() => {
            setDraggingId(null)
            setOverId(null)
          }}
          onDragEnd={() => {
            setDraggingId(null)
            setOverId(null)
          }}
          onMoveUp={() => moveByOffset(id, -1)}
          onMoveDown={() => moveByOffset(id, 1)}
        >
          {blocks[id]}
        </DashboardSection>
      ))}
    </div>
  )
}

type DashKind = "asset" | "security"

const TABS: { key: DashKind; label: string; icon: typeof Boxes }[] = [
  { key: "asset", label: "자산관리 대시보드", icon: Boxes },
  { key: "security", label: "보안 대시보드", icon: ShieldCheck },
]

export function DashboardView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [kind, setKind] = useState<DashKind>("asset")

  return (
    <div className="flex flex-col gap-6">
      {/* 대시보드 전환 세그먼트 토글 */}
      <div className="flex items-center gap-1 self-start rounded-xl border border-border/60 bg-card p-1">
        {TABS.map((tab) => {
          const active = tab.key === kind
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setKind(tab.key)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200",
                active
                  ? "bg-primary/15 text-primary glow-card"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div key={kind} className="animate-view">
        {kind === "asset" ? <AssetDashboardView onNavigate={onNavigate} /> : <SecurityDashboardView onNavigate={onNavigate} />}
      </div>
    </div>
  )
}
