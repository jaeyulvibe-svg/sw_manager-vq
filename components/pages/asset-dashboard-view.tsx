"use client"

import {
  Boxes,
  Server,
  Globe,
  Package,
  Database,
  AlertTriangle,
  Table as TableIcon,
} from "lucide-react"
import {
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  type Accent,
} from "@/components/portal/ui"
import {
  CategoryDistribution,
  AssetHealth,
  ManageNeed,
  MonthlyRegistration,
} from "@/components/dashboard/asset-charts"
import { AssetBoards } from "@/components/dashboard/asset-boards"

/* ---------------- 카테고리별 자산 요약 테이블 ---------------- */

type CategoryRow = {
  category: string
  count: number
  products: string
  eos: number
  patch: number
  notice: number
  dept: string
  status: "정상" | "확인필요" | "조치필요"
}

const rows: CategoryRow[] = [
  {
    category: "OS",
    count: 312,
    products: "Linux, Windows, AIX",
    eos: 8,
    patch: 14,
    notice: 6,
    dept: "인프라팀",
    status: "확인필요",
  },
  {
    category: "WEB/WAS",
    count: 286,
    products: "WebtoB, JEUS, Tomcat, Nginx",
    eos: 12,
    patch: 21,
    notice: 18,
    dept: "미들웨어팀",
    status: "조치필요",
  },
  {
    category: "상용 솔루션",
    count: 418,
    products: "Control-M, 모니터링솔루션, 보안솔루션",
    eos: 15,
    patch: 24,
    notice: 11,
    dept: "운영팀",
    status: "확인필요",
  },
  {
    category: "DB",
    count: 132,
    products: "Oracle, PostgreSQL, MySQL",
    eos: 5,
    patch: 9,
    notice: 4,
    dept: "DBA팀",
    status: "정상",
  },
  {
    category: "Security",
    count: 64,
    products: "OpenSSL, 보안 Agent",
    eos: 3,
    patch: 7,
    notice: 12,
    dept: "보안팀",
    status: "조치필요",
  },
]

const statusAccent: Record<CategoryRow["status"], Accent> = {
  정상: "success",
  확인필요: "warning",
  조치필요: "destructive",
}

function CategorySummary() {
  return (
    <SectionCard
      title="카테고리별 자산 요약"
      subtitle="카테고리 단위 관리 현황 집계"
      icon={TableIcon}
    >
      <TableShell>
        <thead>
          <tr>
            <Th>카테고리</Th>
            <Th>자산 수</Th>
            <Th>주요 제품</Th>
            <Th className="text-center">EOS 임박</Th>
            <Th className="text-center">패치 필요</Th>
            <Th className="text-center">보안공지 매핑</Th>
            <Th>담당 부서</Th>
            <Th>관리 상태</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="transition-colors hover:bg-accent/40">
              <Td className="font-semibold text-foreground">{r.category}</Td>
              <Td className="font-mono tabular-nums">{r.count}</Td>
              <Td className="max-w-xs whitespace-normal text-muted-foreground">
                {r.products}
              </Td>
              <Td className="text-center">
                <span className="font-mono font-semibold text-eos">{r.eos}</span>
              </Td>
              <Td className="text-center">
                <span className="font-mono font-semibold text-warning">
                  {r.patch}
                </span>
              </Td>
              <Td className="text-center">
                <span className="font-mono font-semibold text-destructive">
                  {r.notice}
                </span>
              </Td>
              <Td className="text-muted-foreground">{r.dept}</Td>
              <Td>
                <StatusBadge
                  accent={statusAccent[r.status]}
                  pulse={r.status === "조치필요"}
                >
                  {r.status}
                </StatusBadge>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </SectionCard>
  )
}

export function AssetDashboardView() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI 영역 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="전체 SW 자산"
          value={1248}
          icon={Boxes}
          accent="primary"
          trendLabel="등록된 전체 SW 자산"
          delay={80}
        />
        <StatCard
          label="OS 자산"
          value={312}
          icon={Server}
          accent="primary"
          trendLabel="Linux, Windows, AIX 등"
          delay={160}
        />
        <StatCard
          label="WEB/WAS 자산"
          value={286}
          icon={Globe}
          accent="primary"
          trendLabel="WebtoB, JEUS, Tomcat 등"
          delay={240}
        />
        <StatCard
          label="상용 솔루션"
          value={418}
          icon={Package}
          accent="primary"
          trendLabel="Control-M, 모니터링 등"
          delay={320}
        />
        <StatCard
          label="DB 자산"
          value={132}
          icon={Database}
          accent="primary"
          trendLabel="Oracle, PostgreSQL 등"
          delay={400}
        />
        <StatCard
          label="관리 필요 자산"
          value={82}
          icon={AlertTriangle}
          accent="destructive"
          trendLabel="EOS·패치·공지 확인"
          delay={480}
        />
      </div>

      {/* 메인 차트 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CategoryDistribution />
        <AssetHealth />
      </div>
      <ManageNeed />
      <MonthlyRegistration />

      {/* 카테고리 요약 테이블 */}
      <CategorySummary />

      {/* 게시판 영역 */}
      <AssetBoards />
    </div>
  )
}
