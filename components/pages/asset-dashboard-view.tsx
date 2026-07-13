"use client"

import { useEffect, useState } from "react"
import {
  Boxes,
  Server,
  Globe,
  Package,
  Database,
  AlertTriangle,
  Table as TableIcon,
  Layers,
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
  AssetHealth,
  VendorDistribution,
} from "@/components/dashboard/asset-charts"
import { AssetBoards } from "@/components/dashboard/asset-boards"

type Asset = Tables<"assets">

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

const ASSET_DASHBOARD_BLOCKS = ["kpi", "charts1", "charts2", "summary", "boards"]

export function AssetDashboardView() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const { isAdmin } = useRole()
  const [locked, setLocked] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const { order, moveBefore, moveByOffset, reset } = useDashboardOrder(
    "asset-dashboard-order",
    ASSET_DASHBOARD_BLOCKS,
  )

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("assets")
      .select("*")
      .then(({ data }) => {
        if (data) setAssets(data)
        setLoading(false)
      })
  }, [])

  const total    = assets.length
  const osCount  = assets.filter((a) => a.category === "OS").length
  const webCount = assets.filter((a) => a.category === "WEB").length
  const wasCount = assets.filter((a) => a.category === "WAS").length
  const dbCount  = assets.filter((a) => a.category === "DB").length
  const needAction = assets.filter(
    (a) => (a.eos && new Date(a.eos).getTime() < NOW) ||
            a.patch === "Patch Required" ||
            a.vuln === "Critical",
  ).length

  const editable = isAdmin && !locked

  const blocks: Record<string, React.ReactNode> = {
    kpi: (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="전체 SW 자산"
          value={total}
          icon={Boxes}
          accent="primary"
          trendLabel={loading ? "불러오는 중…" : "등록된 전체 SW 자산"}
          delay={80}
        />
        <StatCard
          label="OS 자산"
          value={osCount}
          icon={Server}
          accent="primary"
          trendLabel="Red Hat Enterprise Linux"
          delay={160}
        />
        <StatCard
          label="WEB 자산"
          value={webCount}
          icon={Globe}
          accent="primary"
          trendLabel="WebtoB, Nginx"
          delay={240}
        />
        <StatCard
          label="WAS 자산"
          value={wasCount}
          icon={Layers}
          accent="primary"
          trendLabel="JEUS, Apache Tomcat"
          delay={320}
        />
        <StatCard
          label="DB 자산"
          value={dbCount}
          icon={Database}
          accent="primary"
          trendLabel="Oracle Database, PostgreSQL"
          delay={400}
        />
        <StatCard
          label="조치 필요 자산"
          value={needAction}
          icon={AlertTriangle}
          accent="destructive"
          trendLabel="EOS만료·패치필요·Critical"
          delay={480}
        />
      </div>
    ),
    charts1: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CategoryDistribution assets={assets} />
        <AssetHealth assets={assets} />
      </div>
    ),
    charts2: (
      <div className="grid grid-cols-1 gap-4">
        <VendorDistribution assets={assets} />
      </div>
    ),
    summary: <CategorySummary assets={assets} />,
    boards: <AssetBoards />,
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
