"use client"

import { useEffect, useState } from "react"
import {
  Boxes,
  Server,
  Package,
  CalendarClock,
  FileEdit,
  Table as TableIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import {
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  ExportExcelButton,
  usePagination,
  Pagination,
  type RiskLevel,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import {
  useDashboardOrder,
  DashboardSection,
  LockToggle,
} from "@/components/portal/dashboard-layout"
import {
  CategoryDistribution,
  EosTimeline,
  ProductVersionBreakdown,
} from "@/components/dashboard/asset-charts"
import { AssetBoards } from "@/components/dashboard/asset-boards"
import type { ViewKey } from "@/components/portal/nav"

type Asset = Tables<"assets">
type AssetRequest = Tables<"asset_requests">

// Computed once at module load (not during render) so it stays a pure value for react-hooks/purity.
const NOW = Date.now()

type CategoryRow = {
  category: string
  count: number
  products: string
  eos: number
  patch: number
  vuln: number
  status: "정상" | "확인필요" | "조치필요"
}

const statusRisk: Record<CategoryRow["status"], RiskLevel> = {
  정상: 1,
  확인필요: 3,
  조치필요: 4,
}

const PRODUCT_MAP: Record<string, string> = {
  OS: "Red Hat Enterprise Linux",
  WEB: "WebtoB, Nginx",
  WAS: "Apache Tomcat, JEUS",
  DB: "Oracle Database, PostgreSQL",
  Middleware: "-",
  Security: "OpenSSL",
}

function buildRows(assets: Asset[]): CategoryRow[] {
  const now = Date.now()
  const categories = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]

  return categories
    .map((cat) => {
      const items = assets.filter((a) => a.category === cat)
      if (items.length === 0) return null
      const eosCount   = items.filter((a) => a.eos && new Date(a.eos).getTime() < now).length
      const patchCount = items.filter((a) => a.patch === "Patch Required").length
      const vulnCount  = items.filter((a) => a.vuln === "Critical" || a.vuln === "High").length
      const status: CategoryRow["status"] =
        (eosCount > 0 || patchCount > 0) ? "조치필요" :
        vulnCount > 0 ? "확인필요" : "정상"
      return {
        category: cat,
        count: items.length,
        products: PRODUCT_MAP[cat] ?? cat,
        eos: eosCount,
        patch: patchCount,
        vuln: vulnCount,
        status,
      }
    })
    .filter(Boolean) as CategoryRow[]
}

function CategorySummary({ assets }: { assets: Asset[] }) {
  const rows = buildRows(assets)
  const pagination = usePagination(rows)
  return (
    <SectionCard
      title="카테고리별 자산 요약"
      subtitle="카테고리 단위 관리 현황 집계"
      icon={TableIcon}
      action={
        <ExportExcelButton
          rows={rows}
          filename="카테고리별_자산_요약"
          columns={[
            { label: "카테고리", value: (r: CategoryRow) => r.category },
            { label: "자산 수", value: (r: CategoryRow) => r.count },
            { label: "주요 제품", value: (r: CategoryRow) => r.products },
            { label: "EOS 만료", value: (r: CategoryRow) => r.eos },
            { label: "패치 필요", value: (r: CategoryRow) => r.patch },
            { label: "취약점 있음", value: (r: CategoryRow) => r.vuln },
            { label: "관리 상태", value: (r: CategoryRow) => r.status },
          ]}
        />
      }
    >
      <TableShell>
        <thead>
          <tr>
            <Th>카테고리</Th>
            <Th>자산 수</Th>
            <Th>주요 제품</Th>
            <Th className="text-center">EOS 만료</Th>
            <Th className="text-center">패치 필요</Th>
            <Th className="text-center">취약점 있음</Th>
            <Th>관리 상태</Th>
          </tr>
        </thead>
        <tbody>
          {pagination.pageItems.map((r) => (
            <tr key={r.category} className="transition-colors hover:bg-accent/40">
              <Td className="font-semibold text-foreground">{r.category}</Td>
              <Td className="font-mono tabular-nums">{r.count}</Td>
              <Td className="max-w-xs whitespace-normal text-muted-foreground">{r.products}</Td>
              <Td className="text-center">
                <span className={`font-mono font-semibold ${r.eos > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {r.eos}
                </span>
              </Td>
              <Td className="text-center">
                <span className={`font-mono font-semibold ${r.patch > 0 ? "text-warning" : "text-muted-foreground"}`}>
                  {r.patch}
                </span>
              </Td>
              <Td className="text-center">
                <span className={`font-mono font-semibold ${r.vuln > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {r.vuln}
                </span>
              </Td>
              <Td>
                <StatusBadge risk={statusRisk[r.status]} pulse={r.status === "조치필요"}>
                  {r.status}
                </StatusBadge>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      {rows.length > 0 && (
        <div className="mt-3">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      )}
    </SectionCard>
  )
}

const ASSET_DASHBOARD_BLOCKS = [
  "kpi",
  "chart-category-eos",
  "chart-product",
  "summary",
  "boards",
]

const ASSET_DASHBOARD_BLOCK_LABELS: Record<string, string> = {
  kpi: "주요 지표 카드",
  "chart-category-eos": "카테고리·EOS 차트",
  "chart-product": "제품·버전별 자산 구성",
  summary: "카테고리별 자산 요약",
  boards: "요청·공지·취약점 보드",
}

const PENDING_APPROVALS: AssetRequest["approval"][] = ["승인대기", "검토중"]

export function AssetDashboardView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useRole()
  const [locked, setLocked] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const { order, hidden, moveBefore, moveByOffset, hideBlock, unhideBlock, reset } = useDashboardOrder(
    "asset-dashboard-order",
    ASSET_DASHBOARD_BLOCKS,
  )

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("asset_requests").select("id, approval"),
    ]).then(([assetsRes, requestsRes]) => {
      if (assetsRes.data) setAssets(assetsRes.data)
      if (requestsRes.data) {
        setPendingRequests(
          requestsRes.data.filter((r) => PENDING_APPROVALS.includes(r.approval)).length,
        )
      }
      setLoading(false)
    })
  }, [])

  const total = assets.length
  const serverCount = new Set(assets.map((a) => a.server).filter(Boolean)).size
  const productCount = new Set(assets.map((a) => `${a.name}__${a.vendor}`)).size

  let eosExpired = 0
  let eosWithin180 = 0
  for (const a of assets) {
    if (!a.eos) continue
    const t = new Date(a.eos).getTime()
    if (Number.isNaN(t)) continue
    const days = Math.floor((t - NOW) / 86400000)
    if (days < 0) eosExpired++
    else if (days <= 180) eosWithin180++
  }
  const eosNear = eosExpired + eosWithin180

  const editable = isAdmin && !locked

  const blocks: Record<string, React.ReactNode> = {
    kpi: (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="전체 SW 자산"
          value={total}
          icon={Boxes}
          accent="primary"
          trendLabel={loading ? "불러오는 중…" : "등록된 전체 SW 자산"}
          delay={80}
          onClick={onNavigate ? () => onNavigate("assets") : undefined}
        />
        <StatCard
          label="관리 서버 수"
          value={serverCount}
          icon={Server}
          accent="primary"
          trendLabel="설치 서버 기준 중복 제거"
          delay={160}
          onClick={onNavigate && isAdmin ? () => onNavigate("admin-servers") : undefined}
        />
        <StatCard
          label="제품 종류 수"
          value={productCount}
          icon={Package}
          accent="primary"
          trendLabel="제품명+제조사 기준 중복 제거"
          delay={240}
          onClick={onNavigate && isAdmin ? () => onNavigate("admin-master") : undefined}
        />
        <StatCard
          label="EOS 180일 이내 자산"
          value={eosNear}
          icon={CalendarClock}
          accent="eos"
          trendLabel={`만료됨 ${eosExpired}건 · 180일 이내 ${eosWithin180}건`}
          delay={320}
          onClick={onNavigate ? () => onNavigate("eos") : undefined}
        />
        <StatCard
          label="변경 요청 대기"
          value={pendingRequests}
          icon={FileEdit}
          accent="warning"
          trendLabel="승인대기·검토중 상태"
          delay={400}
          onClick={onNavigate ? () => onNavigate(isAdmin ? "approval" : "request") : undefined}
        />
      </div>
    ),
    "chart-category-eos": (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryDistribution assets={assets} />
        <EosTimeline assets={assets} />
      </div>
    ),
    "chart-product": <ProductVersionBreakdown assets={assets} />,
    summary: <CategorySummary assets={assets} />,
    boards: <AssetBoards onNavigate={onNavigate} />,
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
            labels={ASSET_DASHBOARD_BLOCK_LABELS}
            onUnhide={unhideBlock}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-6">
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
            className="w-full"
          >
            {blocks[id]}
          </DashboardSection>
        ))}
      </div>
    </div>
  )
}
