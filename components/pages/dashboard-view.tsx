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
  PatchApplicationStatus,
  PatchTaskStatus,
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
type PatchTask = Tables<"patch_tasks">

const accentIconColor: Record<Accent, string> = {
  primary: "text-primary",
  destructive: "text-destructive",
  warning: "text-warning",
  yellow: "text-yellow",
  success: "text-success",
  eos: "text-eos",
  muted: "text-muted-foreground",
}

function RecentUpdates({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const { notifications, loading, markRead } = useNotifications()
  const recent = notifications.slice(0, 5)

  function handleGo(n: (typeof recent)[number]) {
    if (!onNavigate) return
    markRead(n.id)
    onNavigate(n.link.view)
  }

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
              <li
                key={n.id}
                role={onNavigate ? "button" : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onClick={() => handleGo(n)}
                onKeyDown={
                  onNavigate
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleGo(n)
                        }
                      }
                    : undefined
                }
                className={cn(
                  "relative flex gap-3 rounded-lg pb-4 last:pb-0",
                  onNavigate && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
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

const SECURITY_DASHBOARD_BLOCKS = ["hero", "kpi", "charts", "patchStatus", "alerts", "notices", "security-notices"]

const SECURITY_DASHBOARD_BLOCK_LABELS: Record<string, string> = {
  hero: "스캔 현황 배너",
  kpi: "주요 지표 카드",
  charts: "취약점 승인·심각도 차트",
  patchStatus: "패치 적용·조치 현황 차트",
  alerts: "긴급 알림·최근 업데이트",
  notices: "공지사항 게시판",
  "security-notices": "취약점 매핑 현황",
}

function SecurityDashboardView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [patchTasks, setPatchTasks] = useState<PatchTask[]>([])
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useRole()
  const [locked, setLocked] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const { order, hidden, moveBefore, moveByOffset, hideBlock, unhideBlock, reset } = useDashboardOrder(
    "security-dashboard-order",
    SECURITY_DASHBOARD_BLOCKS,
  )

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("vulnerabilities").select("*").order("collected_at", { ascending: false }),
      supabase.from("patch_tasks").select("*"),
    ]).then(([assetsRes, vulnsRes, patchTasksRes]) => {
      if (assetsRes.data) setAssets(assetsRes.data)
      if (vulnsRes.data) setVulns(vulnsRes.data)
      if (patchTasksRes.data) setPatchTasks(patchTasksRes.data)
      setLoading(false)
    })
  }, [])

  const editable = isAdmin && !locked

  const blocks: Record<string, React.ReactNode> = {
    hero: <ScanHero />,
    kpi: <KpiCards assets={assets} vulns={vulns} patchTasks={patchTasks} loading={loading} onNavigate={onNavigate} />,
    charts: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <VulnerabilityApprovalStatus vulns={vulns} />
        <SeverityDonut assets={assets} />
      </div>
    ),
    patchStatus: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PatchApplicationStatus assets={assets} />
        <PatchTaskStatus patchTasks={patchTasks} />
      </div>
    ),
    alerts: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CriticalAlerts assets={assets} vulns={vulns} onNavigate={onNavigate} />
        <RecentUpdates onNavigate={onNavigate} />
      </div>
    ),
    notices: <NoticeBoard onNavigate={onNavigate} />,
    "security-notices": <SecurityNoticeBoard assets={assets} vulns={vulns} onNavigate={onNavigate} />,
  }

  return (
    <div className="flex flex-col gap-6">
      {isAdmin ? (
        <div className="flex justify-end">
          <LockToggle
            locked={locked}
            onToggle={() => setLocked((v) => !v)}
            onReset={reset}
            hidden={hidden}
            labels={SECURITY_DASHBOARD_BLOCK_LABELS}
            onUnhide={unhideBlock}
          />
        </div>
      ) : null}

      {order.filter((id) => !hidden.includes(id)).map((id, index, visibleOrder) => (
        <DashboardSection
          key={id}
          id={id}
          editable={editable}
          draggingId={draggingId}
          isOverTarget={overId === id}
          isFirst={index === 0}
          isLast={index === visibleOrder.length - 1}
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
          onHide={() => hideBlock(id)}
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
