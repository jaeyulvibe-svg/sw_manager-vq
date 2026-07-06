"use client"

import { useEffect, useMemo, useState } from "react"
import { Boxes, Search, Eye, Pencil, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import {
  PageHeader,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  type Accent,
} from "@/components/portal/ui"
import {
  AssetSlideover,
  type AssetDetail,
} from "@/components/portal/asset-slideover"
import { useToast } from "@/components/portal/toast"
import { cn } from "@/lib/utils"

type Asset = Tables<"assets">
type Server = Tables<"servers">
type Category = Asset["category"]

const CATEGORIES: (Category | "전체")[] = ["전체", "OS", "WEB", "DB", "Middleware"]
const STATUS_FILTERS = ["정상", "취약점 있음", "패치 필요", "EOS 임박", "승인 대기"] as const

const vulnAccent: Record<string, Accent> = {
  Critical: "destructive",
  High: "warning",
  Medium: "primary",
  Low: "success",
}
const vulnLabel: Record<string, string> = {
  Critical: "긴급", High: "높음", Medium: "보통", Low: "낮음",
}
const patchAccent: Record<string, Accent> = {
  "Patch Required": "destructive",
  "Patch Available": "warning",
  "Up to Date": "success",
}
const patchLabel: Record<string, string> = {
  "Patch Required": "패치 필요",
  "Patch Available": "패치 가능",
  "Up to Date": "최신",
}
const approvalAccent: Record<string, Accent> = {
  승인대기: "warning", 확인필요: "primary", 승인완료: "success", 긴급: "destructive",
}

function isEosSoon(eos: string | null) {
  if (!eos) return false
  const diff = new Date(eos).getTime() - Date.now()
  return diff < 1000 * 60 * 60 * 24 * 200
}

function isEosExpired(eos: string | null) {
  if (!eos) return false
  return new Date(eos).getTime() < Date.now()
}

function daysUntil(date: string | null) {
  if (!date) return 0
  return Math.round((new Date(date).getTime() - Date.now()) / 86400000)
}

function formatChecked(ts: string | null) {
  if (!ts) return "-"
  const diff = Date.now() - new Date(ts).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "오늘"
  if (days === 1) return "어제"
  return `${days}일 전`
}

function toDetail(a: Asset): AssetDetail {
  return {
    id: a.id,
    name: a.name,
    vendor: a.vendor,
    category: a.category,
    version: a.version,
    latest: a.latest_version ?? a.version,
    server: a.server,
    owner: a.owner,
    vuln: a.vuln,
    patch: patchLabel[a.patch],
    patchAccent: patchAccent[a.patch],
    vulnAccent: vulnAccent[a.vuln],
    eos: a.eos ?? "-",
    eosDaysLeft: daysUntil(a.eos),
    approval: a.approval,
    approvalAccent: approvalAccent[a.approval],
  }
}

export function AssetsView() {
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("전체")
  const [status, setStatus] = useState<string | null>(null)
  const [selected, setSelected] = useState<AssetDetail | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*").order("id"),
      supabase.from("servers").select("*"),
    ]).then(([assetRes, serverRes]) => {
      if (assetRes.data) setAssets(assetRes.data)
      if (serverRes.data) setServers(serverRes.data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const q = query.trim().toLowerCase()
      const matchesQuery =
        !q ||
        [a.name, a.vendor, a.version, a.owner].some((f) =>
          f.toLowerCase().includes(q),
        )
      const matchesCat = cat === "전체" || a.category === cat
      const matchesStatus =
        !status ||
        (status === "정상" && a.vuln === "Low" && a.patch === "Up to Date") ||
        (status === "취약점 있음" && (a.vuln === "Critical" || a.vuln === "High")) ||
        (status === "패치 필요" && a.patch === "Patch Required") ||
        (status === "EOS 임박" && isEosSoon(a.eos)) ||
        (status === "승인 대기" && (a.approval === "승인대기" || a.approval === "긴급"))
      return matchesQuery && matchesCat && matchesStatus
    })
  }, [assets, query, cat, status])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Boxes}
        title="자산 목록"
        description="등록된 SW 자산의 제품명, 벤더, 버전, 담당자, EOS, 취약점, 패치 상태를 통합 관리합니다."
      />

      {/* Search + filters */}
      <div className="glow-card animate-rise flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제품명, 벤더, 버전, 담당자 검색"
            className="w-full rounded-xl border border-border/60 bg-background/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                cat === c
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
          <span className="text-xs font-medium text-muted-foreground">상태</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? null : s)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                status === s
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="animate-rise">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-mono font-semibold text-foreground">{filtered.length}</span>건
            {loading && <span className="ml-2 text-xs text-muted-foreground">불러오는 중…</span>}
          </p>
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>자산 ID</Th>
              <Th>제품명</Th>
              <Th>벤더</Th>
              <Th>분류</Th>
              <Th>현재 버전</Th>
              <Th>설치 서버 / Hostname / IP</Th>
              <Th>담당자</Th>
              <Th>취약점</Th>
              <Th>패치 상태</Th>
              <Th>EOS 날짜</Th>
              <Th>승인 상태</Th>
              <Th>최근 확인일</Th>
              <Th>작업</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-accent/40">
                <Td className="font-mono text-xs text-muted-foreground">{a.id}</Td>
                <Td className="font-semibold">{a.name}</Td>
                <Td className="text-muted-foreground">{a.vendor}</Td>
                <Td>
                  <StatusBadge accent="primary">{a.category}</StatusBadge>
                </Td>
                <Td className="font-mono text-xs">{a.version}</Td>
                <Td>
                  {(() => {
                    const sv = servers.find((s) => s.name === a.server)
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground text-xs">{a.server}</span>
                        {sv && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {sv.hostname} · {sv.ip}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </Td>
                <Td>{a.owner}</Td>
                <Td>
                  <StatusBadge accent={vulnAccent[a.vuln]} pulse={a.vuln === "Critical"}>
                    {vulnLabel[a.vuln]}
                  </StatusBadge>
                </Td>
                <Td>
                  <StatusBadge accent={patchAccent[a.patch]}>
                    {patchLabel[a.patch]}
                  </StatusBadge>
                </Td>
                <Td className={cn(
                  "font-mono text-xs",
                  isEosExpired(a.eos) ? "text-destructive font-semibold" : isEosSoon(a.eos) ? "text-eos" : "",
                )}>
                  {a.eos ?? "-"}
                  {isEosExpired(a.eos) && <span className="ml-1 text-[10px]">[만료]</span>}
                </Td>
                <Td>
                  <StatusBadge accent={approvalAccent[a.approval]} pulse={a.approval === "긴급"}>
                    {a.approval}
                  </StatusBadge>
                </Td>
                <Td className="text-xs text-muted-foreground">{formatChecked(a.checked_at)}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <MiniButton accent="primary" onClick={() => setSelected(toDetail(a))}>
                      <Eye className="h-3 w-3" />상세
                    </MiniButton>
                    <MiniButton accent="muted"><Pencil className="h-3 w-3" />수정</MiniButton>
                    <MiniButton
                      accent="success"
                      onClick={() =>
                        toast({
                          tone: "info",
                          title: "자산 정보 수집 시작",
                          description: `${a.name} (${a.server}) 최신 버전/패치 상태를 수집합니다.`,
                        })
                      }
                    >
                      <RefreshCw className="h-3 w-3" />수집
                    </MiniButton>
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 결과가 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      </div>

      <AssetSlideover asset={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
