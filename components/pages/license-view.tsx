"use client"

import { useEffect, useMemo, useState } from "react"
import { KeyRound, Search, Pencil, Check, X, TriangleAlert, Equal, CircleCheck } from "lucide-react"
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
  ExportExcelButton,
  type RiskLevel,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { cn } from "@/lib/utils"

type Asset = Tables<"assets">
type License = Tables<"licenses">
type Category = Asset["category"] | "전체"
type LicenseStatus = "초과" | "포화" | "여유" | "미등록"

const CATEGORIES: Category[] = ["전체", "OS", "WEB", "WAS", "DB", "Middleware", "Security"]

const statusRisk: Record<Exclude<LicenseStatus, "미등록">, RiskLevel> = {
  초과: 5,
  포화: 3,
  여유: 1,
}

function licenseStatus(lic: License | undefined): LicenseStatus {
  if (!lic) return "미등록"
  if (lic.used_seats > lic.total_seats) return "초과"
  if (lic.used_seats === lic.total_seats) return "포화"
  return "여유"
}

const inputCls =
  "w-20 rounded-lg border border-border/60 bg-background/50 px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none"

type EditState = { assetId: string; total: string; used: string }

export function LicenseView() {
  const { toast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<Category>("전체")
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("licenses").select("*"),
    ]).then(([assetRes, licRes]) => {
      if (assetRes.data) setAssets(assetRes.data)
      if (licRes.data) setLicenses(licRes.data)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [])

  const licenseByAsset = useMemo(() => {
    const map = new Map<string, License>()
    for (const l of licenses) map.set(l.asset_id, l)
    return map
  }, [licenses])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets.filter((a) => {
      const matchesQuery = !q || [a.name, a.vendor, a.owner].some((f) => f.toLowerCase().includes(q))
      const matchesCat = cat === "전체" || a.category === cat
      return matchesQuery && matchesCat
    })
  }, [assets, query, cat])

  const stats = useMemo(() => {
    let registered = 0
    let over = 0
    let full = 0
    let ok = 0
    for (const a of assets) {
      const status = licenseStatus(licenseByAsset.get(a.id))
      if (status === "미등록") continue
      registered++
      if (status === "초과") over++
      else if (status === "포화") full++
      else ok++
    }
    return { registered, over, full, ok }
  }, [assets, licenseByAsset])

  function startEdit(a: Asset) {
    const lic = licenseByAsset.get(a.id)
    setEdit({
      assetId: a.id,
      total: lic ? String(lic.total_seats) : "",
      used: lic ? String(lic.used_seats) : "0",
    })
  }

  async function saveEdit() {
    if (!edit) return
    const total = Number(edit.total)
    const used = Number(edit.used)
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(used) || used < 0) {
      toast({ title: "보유 수량과 사용량은 0 이상의 숫자여야 합니다", tone: "danger" })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("licenses")
      .upsert({ asset_id: edit.assetId, total_seats: total, used_seats: used }, { onConflict: "asset_id" })
    setSaving(false)
    if (error) {
      toast({ title: "저장 실패", description: error.message, tone: "danger" })
      return
    }
    toast({ title: "라이선스 정보가 저장되었습니다", tone: "success" })
    setEdit(null)
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={KeyRound}
        title="SW 라이선스 관리"
        description="자산별 라이선스 보유 수량과 실사용량을 비교해 초과 사용과 과잉 구매를 관리합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="등록된 라이선스" value={stats.registered} icon={KeyRound} accent="primary" delay={80} />
        <StatCard label="초과 사용" value={stats.over} icon={TriangleAlert} risk={5} delay={180} />
        <StatCard label="포화" value={stats.full} icon={Equal} risk={3} delay={280} />
        <StatCard label="여유" value={stats.ok} icon={CircleCheck} risk={1} delay={380} />
      </div>

      <SectionCard
        title="자산별 라이선스 현황"
        subtitle="보유 수량 대비 사용량을 비교합니다"
        icon={KeyRound}
        action={
          <ExportExcelButton
            rows={filtered}
            filename="SW_라이선스_관리"
            columns={[
              { label: "자산명", value: (a: Asset) => a.name },
              { label: "벤더", value: (a: Asset) => a.vendor },
              { label: "분류", value: (a: Asset) => a.category },
              { label: "담당자", value: (a: Asset) => a.owner },
              { label: "보유 수량", value: (a: Asset) => licenseByAsset.get(a.id)?.total_seats ?? "" },
              { label: "사용량", value: (a: Asset) => licenseByAsset.get(a.id)?.used_seats ?? "" },
              { label: "상태", value: (a: Asset) => licenseStatus(licenseByAsset.get(a.id)) },
            ]}
          />
        }
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-border/50 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제품명, 벤더, 담당자 검색"
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
                  cat === c ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
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
              <Th>자산</Th>
              <Th>벤더</Th>
              <Th>분류</Th>
              <Th>담당자</Th>
              <Th>보유 수량</Th>
              <Th>사용량</Th>
              <Th>상태</Th>
              <Th>작업</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const lic = licenseByAsset.get(a.id)
              const status = licenseStatus(lic)
              const isEditing = edit?.assetId === a.id
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
                  <Td className="font-semibold">{a.name}</Td>
                  <Td className="text-muted-foreground">{a.vendor}</Td>
                  <Td>
                    <StatusBadge accent="primary">{a.category}</StatusBadge>
                  </Td>
                  <Td>{a.owner}</Td>
                  <Td>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        value={edit.total}
                        onChange={(e) => setEdit((v) => (v ? { ...v, total: e.target.value } : v))}
                        className={inputCls}
                      />
                    ) : (
                      <span className="font-mono text-xs">{lic?.total_seats ?? "-"}</span>
                    )}
                  </Td>
                  <Td>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        value={edit.used}
                        onChange={(e) => setEdit((v) => (v ? { ...v, used: e.target.value } : v))}
                        className={inputCls}
                      />
                    ) : (
                      <span className="font-mono text-xs">{lic?.used_seats ?? "-"}</span>
                    )}
                  </Td>
                  <Td>
                    {status === "미등록" ? (
                      <StatusBadge accent="muted">미등록</StatusBadge>
                    ) : (
                      <StatusBadge risk={statusRisk[status]} pulse={status === "초과"}>
                        {status}
                      </StatusBadge>
                    )}
                  </Td>
                  <Td>
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <MiniButton accent="success" onClick={saveEdit} disabled={saving}>
                          <Check className="h-3 w-3" />
                          {saving ? "저장 중..." : "저장"}
                        </MiniButton>
                        <MiniButton onClick={() => setEdit(null)} disabled={saving}>
                          <X className="h-3 w-3" />
                          취소
                        </MiniButton>
                      </div>
                    ) : (
                      <MiniButton accent="primary" onClick={() => startEdit(a)}>
                        <Pencil className="h-3 w-3" />
                        {lic ? "수정" : "등록"}
                      </MiniButton>
                    )}
                  </Td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 조건에 맞는 자산이 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      </SectionCard>
    </div>
  )
}
