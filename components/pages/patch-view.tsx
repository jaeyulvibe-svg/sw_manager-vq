"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Eye,
  BellRing,
  Wrench,
  ListChecks,
  Flame,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  type Accent,
} from "@/components/portal/ui"
import { AssetSlideover, type AssetDetail } from "@/components/portal/asset-slideover"
import { useToast } from "@/components/portal/toast"
import type { ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"

type Asset = Tables<"assets">
type Vuln = Asset["vuln"]
type Category = Asset["category"] | "전체"

/* ── 제조사 패치 권고 요약(자산명 기준) ──────────────────────
   실제 서비스에서는 vulnerabilities 테이블/제조사 Source에서 자동 수집되지만,
   현재는 자산명 기준 목업 권고문으로 표기합니다. */
const ADVISORY: Record<string, { cve: string; summary: string }> = {
  "Apache Tomcat": {
    cve: "CVE-2026-0002",
    summary: "요청 처리 경로 원격 코드 실행 취약점 — 10.1.24 이상으로 업그레이드 권고",
  },
  "JEUS": {
    cve: "TMAX-SA-2026-04",
    summary: "세션 관리 모듈 인증 우회 취약점 — 8.5 패치 적용 권고",
  },
  "WebtoB": {
    cve: "TMAX-SA-2026-02",
    summary: "정적 리소스 경로 조작 취약점 — 6.0 패치 적용 권고",
  },
  "Oracle Database": {
    cve: "Multiple CVEs (CPU)",
    summary: "분기 Critical Patch Update — 권한 상승 취약점 다수 포함, 23c 업그레이드 권고",
  },
  "OpenSSL": {
    cve: "CVE-2026-0001",
    summary: "원격 코드 실행 취약점 — 3.3.1 이상으로 긴급 업그레이드 필요",
  },
  "Nginx": {
    cve: "CVE-2026-0003",
    summary: "HTTP/2 요청 스머글링 취약점 — 1.27 이상 업그레이드 권고",
  },
  "Red Hat Enterprise Linux": {
    cve: "RHSA-2026:1042",
    summary: "커널 권한 상승 취약점 — 최신 마이너 버전 업데이트 권고",
  },
  "PostgreSQL": {
    cve: "CVE-2026-0091",
    summary: "권한 검증 우회 취약점 — 16.3 이상으로 패치 적용 권고",
  },
}

function advisoryFor(a: Asset) {
  return (
    ADVISORY[a.name] ?? {
      cve: "제조사 공지 확인 필요",
      summary: `${a.vendor} 최신 보안 패치(${a.latest_version ?? "최신 버전"}) 적용 여부 확인 필요`,
    }
  )
}

const vulnAccent: Record<Vuln, Accent> = {
  Critical: "destructive",
  High: "warning",
  Medium: "primary",
  Low: "success",
}
const vulnLabel: Record<Vuln, string> = {
  Critical: "긴급",
  High: "높음",
  Medium: "보통",
  Low: "낮음",
}
const patchAccent: Record<Asset["patch"], Accent> = {
  "Patch Required": "destructive",
  "Patch Available": "warning",
  "Up to Date": "success",
}
const patchLabel: Record<Asset["patch"], string> = {
  "Patch Required": "패치 필요",
  "Patch Available": "패치 가능",
  "Up to Date": "최신",
}
const approvalAccent: Record<Asset["approval"], Accent> = {
  승인대기: "warning",
  확인필요: "primary",
  승인완료: "success",
  긴급: "destructive",
}

const CATEGORIES: Category[] = ["전체", "OS", "WEB", "DB", "Middleware", "Security"]
const SEVERITIES: (Vuln | "전체")[] = ["전체", "Critical", "High", "Medium", "Low"]
const REVIEW_FILTERS = ["전체", "확인 필요", "승인대기", "긴급", "처리완료"] as const

function needsReview(a: Asset) {
  return a.approval === "확인필요" || a.approval === "승인대기" || a.approval === "긴급"
}
function isEosSoon(eos: string | null) {
  if (!eos) return false
  return new Date(eos).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 200
}
function daysUntil(date: string | null) {
  if (!date) return 0
  return Math.round((new Date(date).getTime() - Date.now()) / 86400000)
}
function toDetail(a: Asset): AssetDetail {
  return {
    id: a.id, name: a.name, vendor: a.vendor, category: a.category,
    version: a.version, latest: a.latest_version ?? a.version,
    server: a.server, owner: a.owner, vuln: a.vuln,
    patch: patchLabel[a.patch], patchAccent: patchAccent[a.patch],
    vulnAccent: vulnAccent[a.vuln], eos: a.eos ?? "-",
    eosDaysLeft: daysUntil(a.eos), approval: a.approval,
    approvalAccent: approvalAccent[a.approval],
  }
}

export function PatchView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<Category>("전체")
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("전체")
  const [review, setReview] = useState<(typeof REVIEW_FILTERS)[number]>("전체")
  const [selected, setSelected] = useState<AssetDetail | null>(null)

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

  // 제조사 패치 권고 대상: 취약점이 있거나 패치가 필요/가능한 자산만 모니터링 대상으로 집계
  const matched = useMemo(
    () => assets.filter((a) => a.vuln !== "Low" || a.patch !== "Up to Date"),
    [assets],
  )

  const stats = useMemo(() => {
    const critical = matched.filter((a) => a.vuln === "Critical").length
    const high = matched.filter((a) => a.vuln === "High").length
    const reviewNeeded = matched.filter(needsReview).length
    return { total: matched.length, critical, high, reviewNeeded }
  }, [matched])

  const filtered = useMemo(() => {
    return [...matched]
      .filter((a) => {
        const q = query.trim().toLowerCase()
        const adv = advisoryFor(a)
        const matchesQuery =
          !q ||
          [a.name, a.vendor, a.owner, a.server, adv.cve].some((f) =>
            f.toLowerCase().includes(q),
          )
        const matchesCat = cat === "전체" || a.category === cat
        const matchesSeverity = severity === "전체" || a.vuln === severity
        const matchesReview =
          review === "전체" ||
          (review === "확인 필요" && a.approval === "확인필요") ||
          (review === "승인대기" && a.approval === "승인대기") ||
          (review === "긴급" && a.approval === "긴급") ||
          (review === "처리완료" && a.approval === "승인완료")
        return matchesQuery && matchesCat && matchesSeverity && matchesReview
      })
      .sort((a, b) => {
        const order: Record<Vuln, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
        return order[a.vuln] - order[b.vuln]
      })
  }, [matched, query, cat, severity, review])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldCheck}
        title="제조사 패치 권고 및 전사 취약점 모니터링"
        description="승인된 제조사 패치 권고를 기준으로 전사 SW 자산의 취약점·패치 현황을 모니터링합니다. 신규 미승인 공지는 'KISA 취약점 공지'에서 검토·승인하세요."
        action={
          onNavigate ? (
            <MiniButton accent="primary" onClick={() => onNavigate("kisa")}>
              KISA 취약점 공지 바로가기<ArrowRight className="h-3 w-3" />
            </MiniButton>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 건수" value={stats.total} icon={ListChecks} accent="primary" delay={80} />
        <StatCard label="CRITICAL" value={stats.critical} icon={Flame} accent="destructive" delay={180} />
        <StatCard label="HIGH" value={stats.high} icon={AlertTriangle} accent="warning" delay={280} />
        <StatCard label="검토 필요" value={stats.reviewNeeded} icon={ClipboardList} accent="eos" delay={380} />
      </div>

      <SectionCard
        title="패치 대상 자산 목록"
        subtitle="보유 자산 중 제조사 패치 권고와 매핑되는 항목입니다"
        icon={ShieldAlert}
      >
        {/* 필터 */}
        <div className="mb-4 flex flex-col gap-3 border-b border-border/50 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제품명, 벤더, 담당자, 서버, CVE 검색"
              className="w-full rounded-xl border border-border/60 bg-background/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">분류</span>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  cat === c ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">심각도</span>
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  severity === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "전체" ? s : vulnLabel[s]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">검토 상태</span>
            {REVIEW_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReview(r)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  review === r ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          총 <span className="font-mono font-semibold text-foreground">{filtered.length}</span>건
          {loading && <span className="ml-2 text-xs">불러오는 중…</span>}
        </p>

        <TableShell>
          <thead>
            <tr>
              <Th>심각도</Th>
              <Th>자산</Th>
              <Th>설치 서버</Th>
              <Th>담당자</Th>
              <Th>현재 → 권고 버전</Th>
              <Th>패치 상태</Th>
              <Th className="min-w-64">패치 요약 (CVE)</Th>
              <Th>EOS</Th>
              <Th>검토 상태</Th>
              <Th>작업</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const adv = advisoryFor(a)
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
                  <Td>
                    <StatusBadge accent={vulnAccent[a.vuln]} pulse={a.vuln === "Critical"}>
                      {vulnLabel[a.vuln]}
                    </StatusBadge>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold text-foreground">{a.name}</span>
                      <span className="text-[11px] text-muted-foreground">{a.vendor} · {a.category}</span>
                    </div>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{a.server}</Td>
                  <Td>{a.owner}</Td>
                  <Td className="font-mono text-xs">
                    {a.version} → <span className="font-semibold text-primary">{a.latest_version ?? "-"}</span>
                  </Td>
                  <Td>
                    <StatusBadge accent={patchAccent[a.patch]}>{patchLabel[a.patch]}</StatusBadge>
                  </Td>
                  <Td className="whitespace-normal text-xs">
                    <p className="text-foreground">{adv.summary}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{adv.cve}</p>
                  </Td>
                  <Td className={cn("font-mono text-xs", isEosSoon(a.eos) && "text-eos")}>{a.eos ?? "-"}</Td>
                  <Td>
                    <StatusBadge accent={approvalAccent[a.approval]} pulse={a.approval === "긴급"}>
                      {a.approval}
                    </StatusBadge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <MiniButton accent="primary" onClick={() => setSelected(toDetail(a))}>
                        <Eye className="h-3 w-3" />상세
                      </MiniButton>
                      <MiniButton
                        accent="warning"
                        onClick={() =>
                          toast({
                            tone: "info",
                            title: "담당자 알림 발송",
                            description: `${a.owner} 담당자에게 ${a.name} 패치 권고를 전송했습니다.`,
                          })
                        }
                      >
                        <BellRing className="h-3 w-3" />알림
                      </MiniButton>
                      <MiniButton
                        accent="success"
                        onClick={() =>
                          toast({
                            tone: "success",
                            title: "패치 작업 등록",
                            description: `${a.name} (${a.server}) 패치 작업이 등록되었습니다.`,
                          })
                        }
                      >
                        <Wrench className="h-3 w-3" />패치 요청
                      </MiniButton>
                    </div>
                  </Td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 조건에 맞는 항목이 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      </SectionCard>

      <AssetSlideover asset={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
