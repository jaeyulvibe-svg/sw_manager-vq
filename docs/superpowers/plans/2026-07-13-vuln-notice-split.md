# KISA/제조사/EOS 취약점 공지 분리 및 승인 현황 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single "KISA 취약점 공지" screen into four screens — KISA-only review, 제조사-only review, EOS(단종/EOL)-only review, and a notice-centric "승인된 취약점 공지" board — backed by a new `source_type` column on `vulnerabilities`.

**Architecture:** Add `source_type: "kisa" | "vendor"` to `vulnerabilities` (it already has `notice_type: "CVE" | "Patch" | "EOS"`). Extract the current `kisa-view.tsx` fetch/match logic into a `useNoticeData(filter)` hook — where `filter` is `{ sourceType?, noticeTypes? }` — and its approve/reject logic into `notice-actions.ts`, then extract its list+detail-panel UI into a shared `NoticeReviewBoard` component parameterized by `sourceType`/`noticeTypes`. `kisa-view.tsx`, a new `vendor-view.tsx`, and a new `eos-notice-view.tsx` become thin wrappers around `NoticeReviewBoard`, each passing a different filter (KISA/vendor screens exclude `notice_type: "EOS"`; the EOS screen includes both source types but only `notice_type: "EOS"`). `patch-view.tsx` is rewritten from an asset-centric table to a notice-centric table (rows = all approved `vulnerabilities`, reusing `useNoticeData` with no filter), gaining a "공지 유형" column so CVE/Patch/EOS rows stay distinguishable.

**Tech Stack:** Next.js App Router (client components), Supabase (`@supabase/supabase-js` via `lib/supabase/client.ts`), Tailwind, `components/portal/ui.tsx` design system, no automated test runner.

## Global Constraints

- No test suite is configured in this repo (see `CLAUDE.md`) — verification is `pnpm build` / `pnpm lint` (type/lint check only, since `next.config.mjs` has `typescript.ignoreBuildErrors: true`) plus manual `pnpm dev` checks against Supabase-backed state.
- Never introduce a real KISA auto-collector — out of scope. Manual registration is the only way KISA-sourced rows get created.
- Keep `ViewKey` values `"kisa"`, `"patch"`, and `"eos"` unchanged (only add `"vendor"` and `"eos-notice"`) so existing `notifications.link_view` values and the existing "EOS 로드맵" screen (`eos-view.tsx`, unrelated to this feature — shows `assets.eos`) keep working untouched.
- Follow the project's existing Korean UI copy conventions and `Accent`/`RiskLevel`/`StatusBadge` design-system usage — don't invent new visual primitives.
- Use `pnpm` (not `npm`/`yarn`) for all commands, per `CLAUDE.md`.

---

### Task 1: `source_type` column — migration + Supabase types

**Files:**
- Create: `supabase/migrations/008_vulnerability_source_type.sql`
- Modify: `lib/supabase/types.ts:99-140` (the `vulnerabilities` table block)

**Interfaces:**
- Produces: `Tables<"vulnerabilities">["source_type"]` = `"kisa" | "vendor"`, used by every later task that reads/writes vulnerabilities.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/008_vulnerability_source_type.sql
ALTER TABLE vulnerabilities
  ADD COLUMN source_type text NOT NULL DEFAULT 'vendor'
  CHECK (source_type IN ('kisa', 'vendor'));

UPDATE vulnerabilities
  SET source_type = 'kisa'
  WHERE source ILIKE '%KISA%';
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or however this project's Supabase project is normally migrated — check `README.md`/`.env` for the project ref if `supabase db push` prompts for one)
Expected: migration `008_vulnerability_source_type` applied with no errors.

- [ ] **Step 3: Verify the backfill**

Run against the Supabase SQL editor or `psql`:
```sql
SELECT source, source_type FROM vulnerabilities ORDER BY source_type;
```
Expected: rows whose `source` contains "KISA" show `source_type = 'kisa'`; all others show `'vendor'`.

- [ ] **Step 4: Update `lib/supabase/types.ts`**

Replace the `vulnerabilities` block at `lib/supabase/types.ts:99-140` with:

```ts
      vulnerabilities: {
        Row: {
          id: string
          cve: string
          title: string
          severity: "Critical" | "High" | "Medium" | "Low"
          product: string
          source: string
          source_url: string | null
          source_type: "kisa" | "vendor"
          mapped_assets: number
          approval: "승인대기" | "검토중" | "승인완료" | "반려"
          notice_type: "CVE" | "Patch" | "EOS"
          collected_at: string
          created_at: string
        }
        Insert: {
          id?: string
          cve: string
          title: string
          severity: "Critical" | "High" | "Medium" | "Low"
          product: string
          source: string
          source_url?: string | null
          source_type?: "kisa" | "vendor"
          mapped_assets?: number
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          notice_type?: "CVE" | "Patch" | "EOS"
          collected_at?: string
          created_at?: string
        }
        Update: {
          cve?: string
          title?: string
          severity?: "Critical" | "High" | "Medium" | "Low"
          product?: string
          source?: string
          source_url?: string | null
          source_type?: "kisa" | "vendor"
          mapped_assets?: number
          approval?: "승인대기" | "검토중" | "승인완료" | "반려"
          notice_type?: "CVE" | "Patch" | "EOS"
          collected_at?: string
        }
```

- [ ] **Step 5: Type-check**

Run: `pnpm build`
Expected: build succeeds (pre-existing `kisa-view.tsx`/`patch-view.tsx` don't reference `source_type` yet, so nothing should break).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/008_vulnerability_source_type.sql lib/supabase/types.ts
git commit -m "feat: add source_type column to vulnerabilities (kisa/vendor)"
```

---

### Task 2: `useNoticeData` hook

**Files:**
- Create: `components/pages/notice-board/use-notice-data.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`, `matchAssets` from `@/lib/vuln-match`, `Tables<"vulnerabilities">`/`Tables<"assets">` from `@/lib/supabase/types`.
- Produces: `useNoticeData(filter?: { sourceType?: "kisa" | "vendor"; noticeTypes?: Vulnerability["notice_type"][] })` returning `{ vulns: Vulnerability[], setVulns, assets: Asset[], matchMap: Map<string, Asset[]>, loading: boolean, refresh: () => void }`. Also re-exports `type Vulnerability`, `type Asset`. Consumed by Task 4 (review screens) and Task 9 (approved board).

- [ ] **Step 1: Write the hook**

```ts
// components/pages/notice-board/use-notice-data.ts
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { matchAssets } from "@/lib/vuln-match"

export type Vulnerability = Tables<"vulnerabilities">
export type Asset = Tables<"assets">

export type NoticeDataFilter = {
  sourceType?: Vulnerability["source_type"]
  noticeTypes?: Vulnerability["notice_type"][]
}

export function useNoticeData(filter: NoticeDataFilter = {}) {
  const { sourceType, noticeTypes } = filter
  const noticeTypesKey = noticeTypes ? noticeTypes.join(",") : ""
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const supabase = createClient()
    let vulnQuery = supabase
      .from("vulnerabilities")
      .select("*")
      .order("collected_at", { ascending: false })
    if (sourceType) vulnQuery = vulnQuery.eq("source_type", sourceType)
    if (noticeTypesKey) vulnQuery = vulnQuery.in("notice_type", noticeTypesKey.split(","))

    Promise.all([vulnQuery, supabase.from("assets").select("*")]).then(([vulnRes, assetRes]) => {
      if (vulnRes.data) setVulns(vulnRes.data)
      if (assetRes.data) setAssets(assetRes.data)
      setLoading(false)
    })
    // sourceType/noticeTypesKey are primitives derived from `filter`, so this only
    // re-fires when the actual filter *value* changes, not on every re-render that
    // happens to construct a new `filter` object literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, noticeTypesKey])

  useEffect(() => {
    load()
  }, [load])

  // 공지의 product 문자열과 실제 보유 자산명을 매칭 (실시간 계산, mapped_assets 컬럼은 신뢰하지 않음)
  const matchMap = useMemo(() => {
    const map = new Map<string, Asset[]>()
    for (const v of vulns) map.set(v.id, matchAssets(v, assets))
    return map
  }, [vulns, assets])

  return { vulns, setVulns, assets, matchMap, loading, refresh: load }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds (this file isn't imported anywhere yet, so it just needs to compile standalone — check with `npx tsc --noEmit` if `pnpm build` is slow to iterate on).

- [ ] **Step 3: Commit**

```bash
git add components/pages/notice-board/use-notice-data.ts
git commit -m "feat: add useNoticeData hook for shared vulnerability/asset fetching"
```

---

### Task 3: `notice-actions.ts` — shared approve/reject

**Files:**
- Create: `components/pages/notice-board/notice-actions.ts`

**Interfaces:**
- Consumes: `Asset`, `Vulnerability` types from `./use-notice-data`.
- Produces: `approveNotice(v: Vulnerability, matched: Asset[]): Promise<{ notifiedCount: number }>` and `rejectNotice(v: Vulnerability): Promise<void>`. Consumed by Task 4's `NoticeReviewBoard`.

- [ ] **Step 1: Write the actions**

```ts
// components/pages/notice-board/notice-actions.ts
"use client"

import { createClient } from "@/lib/supabase/client"
import type { Asset, Vulnerability } from "./use-notice-data"

export async function approveNotice(
  v: Vulnerability,
  matched: Asset[],
): Promise<{ notifiedCount: number }> {
  const supabase = createClient()

  await supabase
    .from("vulnerabilities")
    .update({ approval: "승인완료", mapped_assets: matched.length })
    .eq("id", v.id)

  if (matched.length === 0) return { notifiedCount: 0 }

  const toFlag = matched
    .filter((a) => a.approval !== "승인완료" && a.approval !== "긴급")
    .map((a) => a.id)
  if (toFlag.length > 0) {
    await supabase.from("assets").update({ approval: "확인필요" }).in("id", toFlag)
  }

  await supabase.from("notifications").insert(
    matched.map((a) => ({
      category: "security" as const,
      title: `${v.title} 관련 패치 필요`,
      description: `${a.name} (${a.server}) 자산에 ${v.cve} 관련 보안 패치 적용이 필요합니다. 확인 후 조치해주세요.`,
      asset: `${a.name} ${a.version}`,
      owner: a.owner,
      status: "확인필요" as const,
      urgent: v.severity === "Critical",
      link_view: "patch",
      link_label: "승인된 취약점 공지로 이동",
    })),
  )

  return { notifiedCount: matched.length }
}

export async function rejectNotice(v: Vulnerability): Promise<void> {
  const supabase = createClient()
  await supabase.from("vulnerabilities").update({ approval: "반려" }).eq("id", v.id)
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pages/notice-board/notice-actions.ts
git commit -m "feat: extract approve/reject notice actions into shared module"
```

---

### Task 4: `NoticeReviewBoard` shared component

**Files:**
- Create: `components/pages/notice-board/notice-review-board.tsx`

**Interfaces:**
- Consumes: `useNoticeData` (Task 2), `approveNotice`/`rejectNotice` (Task 3), `useRole` (`@/components/portal/role-context`), `useToast` (`@/components/portal/toast`), `useNotifications` (`@/components/portal/notifications-context`), `ViewKey` (`@/components/portal/nav`).
- Produces: `NoticeReviewBoard({ sourceType, noticeTypes, title, description, icon, onNavigate })` where `sourceType` is optional and `noticeTypes` is a required array. Consumed by Task 5 (`kisa-view.tsx`), Task 6 (`vendor-view.tsx`), Task 7 (`eos-notice-view.tsx`).

This is the current `kisa-view.tsx` body (list + detail panel + approve/reject), generalized so the title/description/icon and the `useNoticeData` filter are props instead of hardcoded.

- [ ] **Step 1: Write the component**

```tsx
// components/pages/notice-board/notice-review-board.tsx
"use client"

import { useState } from "react"
import {
  ExternalLink,
  Link2,
  Check,
  X,
  BellDot,
  Server,
  ArrowRight,
  type LucideIcon,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  MiniButton,
  usePagination,
  Pagination,
  type RiskLevel,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useNotifications } from "@/components/portal/notifications-context"
import { useToast } from "@/components/portal/toast"
import type { ViewKey } from "@/components/portal/nav"
import { useNoticeData, type Vulnerability } from "./use-notice-data"
import { approveNotice, rejectNotice } from "./notice-actions"
import { cn } from "@/lib/utils"

type Severity = Vulnerability["severity"]
type Status = Vulnerability["approval"]

const FILTERS = ["전체", "Critical", "High", "Medium", "Low", "미매핑", "승인대기"] as const

const sevRisk: Record<Severity, RiskLevel> = {
  Critical: 5, High: 4, Medium: 3, Low: 2,
}
const statusRisk: Record<Status, RiskLevel> = {
  반려: 5, 승인대기: 3, 검토중: 2, 승인완료: 1,
}

function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

function toUrl(sourceUrl: string) {
  return /^https?:\/\//.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`
}

export function NoticeReviewBoard({
  sourceType,
  noticeTypes,
  title,
  description,
  icon: Icon,
  onNavigate,
}: {
  sourceType?: "kisa" | "vendor"
  noticeTypes: Vulnerability["notice_type"][]
  title: string
  description: string
  icon: LucideIcon
  onNavigate?: (view: ViewKey) => void
}) {
  const { isAdmin } = useRole()
  const { toast } = useToast()
  const { refresh: refreshNotifications } = useNotifications()
  const { vulns, setVulns, matchMap, loading } = useNoticeData({ sourceType, noticeTypes })

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = vulns.filter((v) => {
    const count = matchMap.get(v.id)?.length ?? 0
    if (filter === "전체") return true
    if (filter === "미매핑") return count === 0
    if (filter === "승인대기") return v.approval === "승인대기"
    return v.severity === filter
  })

  const pagination = usePagination(filtered, 10)

  const selected = vulns.find((v) => v.id === selectedId) ?? vulns[0]
  const selectedMatches = selected ? matchMap.get(selected.id) ?? [] : []

  async function handleApprove(v: Vulnerability) {
    if (busyId) return
    setBusyId(v.id)
    const matched = matchMap.get(v.id) ?? []
    const { notifiedCount } = await approveNotice(v, matched)

    setVulns((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, approval: "승인완료", mapped_assets: matched.length } : x)),
    )
    if (notifiedCount > 0) refreshNotifications()
    setBusyId(null)
    toast({
      tone: "success",
      title: "승인 완료",
      description:
        notifiedCount > 0
          ? `매칭된 자산 ${notifiedCount}대의 담당자에게 패치 권고를 전달했습니다.`
          : "매칭된 자산이 없어 별도 알림은 발송되지 않았습니다.",
    })
  }

  async function handleReject(v: Vulnerability) {
    if (busyId) return
    setBusyId(v.id)
    await rejectNotice(v)
    setVulns((prev) => prev.map((x) => (x.id === v.id ? { ...x, approval: "반려" } : x)))
    setBusyId(null)
    toast({ tone: "info", title: "공지 반려", description: `"${v.title}" 공지를 반려 처리했습니다.` })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Icon} title={title} description={description} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); pagination.setPage(1) }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {!loading && vulns.length === 0 ? (
        <SectionCard title="공지 없음" icon={Icon}>
          <p className="text-sm text-muted-foreground">수집된 취약점 공지가 없습니다.</p>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-3 lg:col-span-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : (
              pagination.pageItems.map((n) => {
                const matchedCount = matchMap.get(n.id)?.length ?? 0
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedId(n.id)}
                    className={cn(
                      "group animate-rise relative rounded-2xl border border-border/60 bg-card p-4 text-left transition-all glow-card hover:-translate-y-0.5",
                      selectedId === n.id && "bg-primary/5",
                    )}
                  >
                    {selectedId === n.id ? (
                      <span
                        className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge risk={sevRisk[n.severity]} pulse={n.severity === "Critical"}>
                        {n.severity}
                      </StatusBadge>
                      <span className="font-mono text-xs text-muted-foreground">{n.cve}</span>
                      {matchedCount === 0 ? (
                        <StatusBadge accent="muted">미매핑</StatusBadge>
                      ) : null}
                      <StatusBadge risk={statusRisk[n.approval]} className="ml-auto">
                        {n.approval}
                      </StatusBadge>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{n.source}</span>
                      <span className="flex items-center gap-1"><Server className="h-3 w-3" />영향 {n.product}</span>
                      <span>{n.approval === "승인완료" ? `자산 매핑 확정 ${matchedCount}대` : `영향받는 자산 ${matchedCount}대`}</span>
                      <span className="ml-auto">{formatCollected(n.collected_at)}</span>
                    </div>
                  </button>
                )
              })
            )}
            {!loading && filtered.length > 0 ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            ) : null}
          </div>

          {selected ? (
            <div className="lg:col-span-2">
              <SectionCard title="공지 상세" subtitle={selected.cve} icon={Icon}>
                <div className="flex flex-col gap-4">
                  <div>
                    <StatusBadge risk={sevRisk[selected.severity]} pulse={selected.severity === "Critical"}>
                      {selected.severity}
                    </StatusBadge>
                    <h4 className="mt-2 text-sm font-bold text-foreground">{selected.title}</h4>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      ["수집 Source", selected.source],
                      ["CVE ID", selected.cve],
                      ["영향 제품", selected.product],
                      ["수집 일시", formatCollected(selected.collected_at)],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0 rounded-lg border border-border/60 bg-background/40 p-2.5">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="mt-0.5 break-words font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Server className="h-3.5 w-3.5 text-primary" />
                      {selected.approval === "승인완료"
                        ? `자산 매핑 확정 ${selectedMatches.length}대`
                        : `영향받는 자산 ${selectedMatches.length}대 (승인 전)`}
                    </p>
                    {selectedMatches.length > 0 ? (
                      <>
                        <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          {selectedMatches.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5">
                              <span className="min-w-0 truncate font-mono">{a.id} · {a.server}</span>
                              <span className="shrink-0">{a.owner}</span>
                            </li>
                          ))}
                        </ul>
                        {selected.approval !== "승인완료" ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            제품명 기준으로 자동 매칭된 실제 보유 자산입니다. 관리자가 승인해야 확정되며, 승인 전까지는 담당자에게 전달되지 않습니다.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        현재 보유 자산 중 매칭되는 항목이 없습니다.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selected.source_url ? (
                      <MiniButton accent="primary" onClick={() => window.open(toUrl(selected.source_url!), "_blank")}>
                        <ExternalLink className="h-3 w-3" />원문 보기
                      </MiniButton>
                    ) : null}
                    {isAdmin ? (
                      selected.approval === "승인완료" || selected.approval === "반려" ? (
                        <StatusBadge risk={selected.approval === "승인완료" ? 1 : 5}>
                          {selected.approval === "승인완료" ? "승인 완료 · 담당자 전달됨" : "반려됨"}
                        </StatusBadge>
                      ) : (
                        <>
                          <MiniButton
                            accent="success"
                            disabled={!!busyId}
                            onClick={() => handleApprove(selected)}
                          >
                            <Check className="h-3 w-3" />
                            {busyId === selected.id ? "처리 중..." : "승인 및 담당자 전달"}
                          </MiniButton>
                          <MiniButton
                            accent="destructive"
                            disabled={!!busyId}
                            onClick={() => handleReject(selected)}
                          >
                            <X className="h-3 w-3" />
                            {busyId === selected.id ? "처리 중..." : "반려"}
                          </MiniButton>
                        </>
                      )
                    ) : (
                      <MiniButton accent="warning"><BellDot className="h-3 w-3" />알림 수신 확인</MiniButton>
                    )}
                    {selected.approval === "승인완료" && onNavigate ? (
                      <MiniButton accent="eos" onClick={() => onNavigate("patch")}>
                        <ArrowRight className="h-3 w-3" />승인된 취약점 공지에서 보기
                      </MiniButton>
                    ) : null}
                  </div>
                  {!isAdmin ? (
                    <p className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                      사용자는 관리자의 승인 후 배정된 자산에 대한 알림을 확인합니다.
                    </p>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/pages/notice-board/notice-review-board.tsx
git commit -m "feat: add shared NoticeReviewBoard component for KISA/vendor/EOS review screens"
```

---

### Task 5: Refactor `kisa-view.tsx` to a thin wrapper

**Files:**
- Modify: `components/pages/kisa-view.tsx` (full replace)

**Interfaces:**
- Consumes: `NoticeReviewBoard` (Task 4).
- Produces: `KisaView({ onNavigate })` — same public signature as before, so `app/page.tsx`'s existing `case "kisa": return <KisaView onNavigate={setActive} />` keeps working unchanged.

- [ ] **Step 1: Replace the file contents**

```tsx
// components/pages/kisa-view.tsx
"use client"

import { ShieldAlert } from "lucide-react"
import { NoticeReviewBoard } from "@/components/pages/notice-board/notice-review-board"
import type { ViewKey } from "@/components/portal/nav"

export function KisaView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  return (
    <NoticeReviewBoard
      sourceType="kisa"
      noticeTypes={["CVE", "Patch"]}
      title="KISA 취약점 공지"
      description="KISA에서 발표한 취약점 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. 승인된 공지는 '승인된 취약점 공지'에서 전사 현황으로 확인할 수 있습니다."
      icon={ShieldAlert}
      onNavigate={onNavigate}
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Manual check**

Run: `pnpm dev`, open the app, navigate to "KISA 취약점 공지" (still under its old nav slot at this point — Task 8 moves it into the group).
Expected: same behavior as before this refactor — list + detail panel, filters, approve/reject for admin, "알림 수신 확인" for non-admin. Only rows with `source_type = 'kisa'` and `notice_type` in `CVE`/`Patch` should appear (likely few or zero rows until Task 10 lets you register KISA-tagged rows — that's expected at this point in the plan).

- [ ] **Step 4: Commit**

```bash
git add components/pages/kisa-view.tsx
git commit -m "refactor: kisa-view.tsx delegates to shared NoticeReviewBoard"
```

---

### Task 6: New `vendor-view.tsx`

**Files:**
- Create: `components/pages/vendor-view.tsx`

**Interfaces:**
- Consumes: `NoticeReviewBoard` (Task 4).
- Produces: `VendorView({ onNavigate })`. Consumed by Task 8 (`app/page.tsx`).

- [ ] **Step 1: Write the file**

```tsx
// components/pages/vendor-view.tsx
"use client"

import { ShieldAlert } from "lucide-react"
import { NoticeReviewBoard } from "@/components/pages/notice-board/notice-review-board"
import type { ViewKey } from "@/components/portal/nav"

export function VendorView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  return (
    <NoticeReviewBoard
      sourceType="vendor"
      noticeTypes={["CVE", "Patch"]}
      title="제조사 취약점 공지"
      description="Apache·TmaxSoft 등 제조사 공식 보안 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. 승인된 공지는 '승인된 취약점 공지'에서 전사 현황으로 확인할 수 있습니다."
      icon={ShieldAlert}
      onNavigate={onNavigate}
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds (file is unused until Task 8 wires it in — that's fine, it's still type-checked).

- [ ] **Step 3: Commit**

```bash
git add components/pages/vendor-view.tsx
git commit -m "feat: add VendorView screen for manufacturer vulnerability notices"
```

---

### Task 7: New `eos-notice-view.tsx`

**Files:**
- Create: `components/pages/eos-notice-view.tsx`

**Interfaces:**
- Consumes: `NoticeReviewBoard` (Task 4).
- Produces: `EosNoticeView({ onNavigate })`. Consumed by Task 8 (`app/page.tsx`).

This screen shows `notice_type: "EOS"` notices (단종/EOL 공지) regardless of `source_type` — a KISA-tagged or vendor-tagged EOS notice both show up here. This is a different concept from the existing "EOS 로드맵" (`eos-view.tsx`), which displays `assets.eos` (support end dates on owned assets) and is not touched by this plan.

- [ ] **Step 1: Write the file**

```tsx
// components/pages/eos-notice-view.tsx
"use client"

import { CalendarClock } from "lucide-react"
import { NoticeReviewBoard } from "@/components/pages/notice-board/notice-review-board"
import type { ViewKey } from "@/components/portal/nav"

export function EosNoticeView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  return (
    <NoticeReviewBoard
      noticeTypes={["EOS"]}
      title="EOS 공지"
      description="제조사가 발표한 단종(EOL)/지원종료 공지를 검토·승인하고 SW 자산과 매핑하는 화면입니다. KISA·제조사 출처를 가리지 않고 EOS 공지를 모두 모아 보여줍니다. 승인된 공지는 '승인된 취약점 공지'에서 확인할 수 있습니다."
      icon={CalendarClock}
      onNavigate={onNavigate}
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds (file is unused until Task 8 wires it in).

- [ ] **Step 3: Commit**

```bash
git add components/pages/eos-notice-view.tsx
git commit -m "feat: add EosNoticeView screen for EOS/EOL vulnerability notices"
```

---

### Task 8: Navigation — `nav.ts` group + `page.tsx` routing

**Files:**
- Modify: `components/portal/nav.ts:18-32` (`ViewKey`) and `components/portal/nav.ts:65-86` (`NAV_ITEMS`)
- Modify: `app/page.tsx:21-22` (imports) and `app/page.tsx:70-73` (`renderView` switch)

**Interfaces:**
- Consumes: `VendorView` (Task 6), `EosNoticeView` (Task 7).
- Produces: `ViewKey` now includes `"vendor"` and `"eos-notice"`; sidebar shows a "취약점 공지" group with 4 children.

- [ ] **Step 1: Add `"vendor"` and `"eos-notice"` to `ViewKey`**

In `components/portal/nav.ts`, change:

```ts
export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "request"
  | "approval"
  | "kisa"
  | "patch"
```

to:

```ts
export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "request"
  | "approval"
  | "kisa"
  | "vendor"
  | "eos-notice"
  | "patch"
```

(`"eos"` here is the existing, untouched "EOS 로드맵" key — `"eos-notice"` is the new, distinct key for this feature's EOS review screen.)

- [ ] **Step 2: Replace the flat `kisa`/`patch` nav items with a group**

In `components/portal/nav.ts`, change:

```ts
  { key: "kisa", label: "KISA 취약점 공지", icon: ShieldAlert },
  { key: "patch", label: "패치&취약점 모니터링", icon: ShieldCheck },
```

to:

```ts
  {
    groupKey: "vuln-notice",
    label: "취약점 공지",
    icon: ShieldAlert,
    children: [
      { key: "kisa", label: "KISA 취약점 공지", icon: ShieldAlert },
      { key: "vendor", label: "제조사 취약점 공지", icon: ShieldAlert },
      { key: "eos-notice", label: "EOS 공지", icon: CalendarClock },
      { key: "patch", label: "승인된 취약점 공지", icon: ShieldCheck },
    ],
  },
```

`CalendarClock` is already imported at the top of `nav.ts` (used by the existing `"eos"` item), so no new icon import is needed.

- [ ] **Step 3: Wire `VendorView`/`EosNoticeView` into `app/page.tsx`**

Add the imports next to the `KisaView` import (`app/page.tsx:21-22`):

```ts
import { KisaView } from "@/components/pages/kisa-view"
import { VendorView } from "@/components/pages/vendor-view"
import { EosNoticeView } from "@/components/pages/eos-notice-view"
import { PatchView } from "@/components/pages/patch-view"
```

Add cases next to the `"kisa"` case in `renderView()` (`app/page.tsx:70-73`):

```ts
      case "kisa":
        return <KisaView onNavigate={setActive} />
      case "vendor":
        return <VendorView onNavigate={setActive} />
      case "eos-notice":
        return <EosNoticeView onNavigate={setActive} />
      case "patch":
        return <PatchView onNavigate={setActive} />
```

- [ ] **Step 4: Type-check**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Manual check**

Run: `pnpm dev`, open the app.
Expected: sidebar shows a "취약점 공지" group (expandable) containing "KISA 취약점 공지" / "제조사 취약점 공지" / "EOS 공지" / "승인된 취약점 공지" (the last one still showing the old patch-view content until Task 9). Clicking "제조사 취약점 공지" renders `VendorView` with `source_type = 'vendor'` and `notice_type` in (CVE, Patch) rows — i.e. most current seed data except any EOS-tagged rows, which should now be absent from this screen. Clicking "EOS 공지" renders `EosNoticeView` showing only `notice_type = 'EOS'` rows (currently the TmaxSoft-sourced EOL notices, if any were collected/seeded). The existing "EOS 로드맵" top-level item is untouched and still shows `assets.eos` data.

- [ ] **Step 6: Commit**

```bash
git add components/portal/nav.ts app/page.tsx
git commit -m "feat: add vendor/EOS nav entries and group KISA/vendor/EOS/approved under 취약점 공지"
```

---

### Task 9: Rewrite `patch-view.tsx` as the notice-centric "승인된 취약점 공지" board

**Files:**
- Modify: `components/pages/patch-view.tsx` (full replace)

**Interfaces:**
- Consumes: `useNoticeData` (Task 2, called with no filter to get all approved notices regardless of source/notice type).
- Produces: `PatchView({ onNavigate })` — same public signature, so `app/page.tsx`'s `case "patch"` (Task 8) keeps working unchanged.

This flips the table from asset-centric rows to notice-centric rows (rows = `vulnerabilities` where `approval === "승인완료"`), keeping stats cards, search, filters, sort, column visibility, and Excel export, and adds a "공지 유형" (CVE/Patch/EOS) column/filter so approved EOS notices stay distinguishable from CVE/Patch ones.

- [ ] **Step 1: Replace the file contents**

```tsx
// components/pages/patch-view.tsx
"use client"

import { Fragment, useMemo, useState } from "react"
import {
  ShieldCheck,
  Search,
  ListChecks,
  Flame,
  AlertTriangle,
  PackageX,
  ArrowRight,
  Server,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  X,
} from "lucide-react"
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
  SortTh,
  ColumnVisibilityMenu,
  loadColumnVisibility,
  TABLE_HEADER_CELL_H,
  TABLE_ROW_CELL_H,
  usePagination,
  Pagination,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
import { useNoticeData, type Vulnerability } from "@/components/pages/notice-board/use-notice-data"
import type { ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"

type Severity = Vulnerability["severity"]
type SourceType = Vulnerability["source_type"]
type NoticeType = Vulnerability["notice_type"]

const sevRisk: Record<Severity, RiskLevel> = { Critical: 5, High: 4, Medium: 3, Low: 2 }
const sourceTypeLabel: Record<SourceType, string> = { kisa: "KISA", vendor: "제조사" }
const noticeTypeAccent: Record<NoticeType, Accent> = { CVE: "destructive", Patch: "warning", EOS: "eos" }

const SEVERITIES: (Severity | "전체")[] = ["전체", "Critical", "High", "Medium", "Low"]
const SOURCE_TYPES: (SourceType | "전체")[] = ["전체", "kisa", "vendor"]
const NOTICE_TYPES: (NoticeType | "전체")[] = ["전체", "CVE", "Patch", "EOS"]

type ColKey = "severity" | "cve" | "title" | "noticeType" | "sourceType" | "source" | "product" | "mapped"
const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "severity", label: "심각도" },
  { key: "cve", label: "CVE" },
  { key: "title", label: "제목" },
  { key: "noticeType", label: "공지 유형" },
  { key: "sourceType", label: "출처 유형" },
  { key: "source", label: "출처" },
  { key: "product", label: "영향 제품" },
  { key: "mapped", label: "매핑 자산 수" },
]
const FACTORY_VISIBLE: ColKey[] = ALL_COLS.map((c) => c.key)
const LS_KEY = "patch_view_columns"

type SortKey = ColKey | "none"
type SortDir = "asc" | "desc"

function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

export function PatchView({ onNavigate }: { onNavigate?: (view: ViewKey) => void }) {
  const { vulns, matchMap, loading } = useNoticeData()
  const [query, setQuery] = useState("")
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("전체")
  const [sourceType, setSourceType] = useState<(typeof SOURCE_TYPES)[number]>("전체")
  const [noticeType, setNoticeType] = useState<(typeof NOTICE_TYPES)[number]>("전체")
  const [sortKey, setSortKey] = useState<SortKey>("severity")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [visible, setVisible] = useState<ColKey[]>(() => loadColumnVisibility(LS_KEY, FACTORY_VISIBLE))
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const approved = useMemo(() => vulns.filter((v) => v.approval === "승인완료"), [vulns])

  const stats = useMemo(() => {
    const critical = approved.filter((v) => v.severity === "Critical").length
    const high = approved.filter((v) => v.severity === "High").length
    const unmapped = approved.filter((v) => (matchMap.get(v.id)?.length ?? 0) === 0).length
    return { total: approved.length, critical, high, unmapped }
  }, [approved, matchMap])

  function sortValue(v: Vulnerability, key: SortKey): string | number {
    if (key === "severity") return sevRisk[v.severity]
    if (key === "mapped") return matchMap.get(v.id)?.length ?? 0
    if (key === "sourceType") return sourceTypeLabel[v.source_type]
    if (key === "noticeType") return v.notice_type
    if (key === "none") return 0
    return String(v[key as "cve" | "title" | "source" | "product"])
  }

  const filteredSorted = useMemo(() => {
    return [...approved]
      .filter((v) => {
        const q = query.trim().toLowerCase()
        const matchesQuery =
          !q || [v.title, v.cve, v.product, v.source].some((f) => f.toLowerCase().includes(q))
        const matchesSeverity = severity === "전체" || v.severity === severity
        const matchesSourceType = sourceType === "전체" || v.source_type === sourceType
        const matchesNoticeType = noticeType === "전체" || v.notice_type === noticeType
        return matchesQuery && matchesSeverity && matchesSourceType && matchesNoticeType
      })
      .sort((a, b) => {
        const va = sortValue(a, sortKey)
        const vb = sortValue(b, sortKey)
        const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
        return sortDir === "asc" ? d : -d
      })
  }, [approved, query, severity, sourceType, noticeType, sortKey, sortDir, matchMap])

  const pagination = usePagination(filteredSorted)

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
    pagination.setPage(1)
  }

  const show = (key: ColKey) => visible.includes(key)

  const filterChips: { key: string; label: string; onRemove: () => void }[] = []
  if (severity !== "전체") filterChips.push({ key: "severity", label: severity, onRemove: () => setSeverity("전체") })
  if (sourceType !== "전체") {
    filterChips.push({
      key: "sourceType",
      label: sourceTypeLabel[sourceType as SourceType],
      onRemove: () => setSourceType("전체"),
    })
  }
  if (noticeType !== "전체") {
    filterChips.push({ key: "noticeType", label: noticeType, onRemove: () => setNoticeType("전체") })
  }

  function resetFilters() {
    setQuery("")
    setSeverity("전체")
    setSourceType("전체")
    setNoticeType("전체")
    pagination.setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldCheck}
        title="승인된 취약점 공지"
        description="KISA·제조사에서 승인 완료된 취약점·EOS 공지를 전사 자산 매핑 기준으로 조회합니다. 신규 미승인 공지는 KISA/제조사/EOS 공지 화면에서 검토·승인하세요."
        action={
          onNavigate ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <MiniButton accent="primary" onClick={() => onNavigate("kisa")}>
                KISA 취약점 공지 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
              <MiniButton accent="primary" onClick={() => onNavigate("vendor")}>
                제조사 취약점 공지 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
              <MiniButton accent="eos" onClick={() => onNavigate("eos-notice")}>
                EOS 공지 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 승인 건수" value={stats.total} icon={ListChecks} accent="primary" delay={80} />
        <StatCard label="CRITICAL" value={stats.critical} icon={Flame} risk={5} delay={180} />
        <StatCard label="HIGH" value={stats.high} icon={AlertTriangle} risk={4} delay={280} />
        <StatCard label="미매핑" value={stats.unmapped} icon={PackageX} accent="eos" delay={380} />
      </div>

      <SectionCard
        title="승인된 공지 목록"
        subtitle="승인 완료된 취약점·EOS 공지와 매핑된 자산 현황입니다"
        icon={ShieldCheck}
        action={
          <div className="flex items-center gap-1.5">
            <ExportExcelButton
              rows={filteredSorted}
              filename="승인된_취약점_공지"
              columns={[
                { label: "심각도", value: (v: Vulnerability) => v.severity },
                { label: "CVE", value: (v: Vulnerability) => v.cve },
                { label: "제목", value: (v: Vulnerability) => v.title },
                { label: "공지 유형", value: (v: Vulnerability) => v.notice_type },
                { label: "출처 유형", value: (v: Vulnerability) => sourceTypeLabel[v.source_type] },
                { label: "출처", value: (v: Vulnerability) => v.source },
                { label: "영향 제품", value: (v: Vulnerability) => v.product },
                { label: "매핑 자산 수", value: (v: Vulnerability) => matchMap.get(v.id)?.length ?? 0 },
              ]}
            />
            <ColumnVisibilityMenu
              allCols={ALL_COLS}
              visible={visible}
              onChange={setVisible}
              factoryDefault={FACTORY_VISIBLE}
              storageKey={LS_KEY}
            />
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                placeholder="제목, CVE, 제품명, 출처 검색"
                className="w-full rounded-lg border border-border/60 bg-background/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <MiniButton
              onClick={() => setDetailFiltersOpen((v) => !v)}
              className={cn(detailFiltersOpen && "border-primary/50 bg-primary/10 text-primary")}
            >
              상세 필터{filterChips.length > 0 ? ` (${filterChips.length})` : ""}
              {detailFiltersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </MiniButton>
            <MiniButton onClick={resetFilters}>
              <RotateCcw className="h-3 w-3" />
              초기화
            </MiniButton>
          </div>

          {detailFiltersOpen ? (
            <div className="animate-rise flex flex-col gap-3 border-t border-border/50 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">심각도</span>
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSeverity(s); pagination.setPage(1) }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      severity === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">출처 유형</span>
                {SOURCE_TYPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSourceType(s); pagination.setPage(1) }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      sourceType === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s === "전체" ? s : sourceTypeLabel[s]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">공지 유형</span>
                {NOTICE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setNoticeType(t); pagination.setPage(1) }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      noticeType === t ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {filterChips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
                  <span className="text-[11px] text-muted-foreground">적용된 조건</span>
                  {filterChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
                    >
                      {chip.label}
                      <button
                        type="button"
                        onClick={chip.onRemove}
                        aria-label={`${chip.label} 필터 해제`}
                        className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          총 <span className="font-mono font-semibold text-foreground">{filteredSorted.length}</span>건
          {loading && <span className="ml-2 text-xs">불러오는 중…</span>}
        </p>

        <TableShell scrollHint>
          <thead>
            <tr>
              {show("severity") && <SortTh col="severity" label="심각도" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("cve") && <SortTh col="cve" label="CVE" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("title") && <SortTh col="title" label="제목" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("noticeType") && <SortTh col="noticeType" label="공지 유형" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("sourceType") && <SortTh col="sourceType" label="출처 유형" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("source") && <SortTh col="source" label="출처" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("product") && <SortTh col="product" label="영향 제품" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("mapped") && <SortTh col="mapped" label="매핑 자산 수" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              <Th className={TABLE_HEADER_CELL_H}>작업</Th>
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map((v) => {
              const matched = matchMap.get(v.id) ?? []
              const expanded = expandedId === v.id
              return (
                <Fragment key={v.id}>
                  <tr className="transition-colors hover:bg-accent/40">
                    {show("severity") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge risk={sevRisk[v.severity]} pulse={v.severity === "Critical"}>{v.severity}</StatusBadge>
                      </Td>
                    )}
                    {show("cve") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{v.cve}</Td>}
                    {show("title") && <Td className={cn("whitespace-normal text-xs", TABLE_ROW_CELL_H)}>{v.title}</Td>}
                    {show("noticeType") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge accent={noticeTypeAccent[v.notice_type]}>{v.notice_type}</StatusBadge>
                      </Td>
                    )}
                    {show("sourceType") && (
                      <Td className={TABLE_ROW_CELL_H}>
                        <StatusBadge accent={v.source_type === "kisa" ? "primary" : "muted"}>
                          {sourceTypeLabel[v.source_type]}
                        </StatusBadge>
                      </Td>
                    )}
                    {show("source") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{v.source}</Td>}
                    {show("product") && <Td className={cn("text-xs", TABLE_ROW_CELL_H)}>{v.product}</Td>}
                    {show("mapped") && <Td className={TABLE_ROW_CELL_H}>{matched.length}대</Td>}
                    <Td className={TABLE_ROW_CELL_H}>
                      <MiniButton accent="primary" onClick={() => setExpandedId(expanded ? null : v.id)}>
                        <Server className="h-3 w-3" />
                        매핑 자산{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </MiniButton>
                    </Td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={ALL_COLS.length + 1} className="border-b border-border/40 bg-background/40 px-3 py-3">
                        {matched.length > 0 ? (
                          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {matched.map((a) => (
                              <li key={a.id} className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
                                <span className="font-mono">{a.id}</span> · {a.name} · {a.server} · {a.owner}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">매칭되는 자산이 없습니다.</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground">수집 일시: {formatCollected(v.collected_at)}</p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
            {!loading && pagination.pageItems.length === 0 && (
              <tr>
                <td colSpan={ALL_COLS.length + 1} className="py-8 text-center text-muted-foreground">
                  검색 조건에 맞는 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </TableShell>

        <div className="mt-3">
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      </SectionCard>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: build succeeds. Watch for unused-import errors and confirm the raw `<td colSpan=...>` elements (not the `Td` wrapper, which doesn't accept `colSpan`) compile fine as plain DOM elements.

- [ ] **Step 3: Manual check**

Run: `pnpm dev`, navigate to "승인된 취약점 공지" via the new nav group (Task 8 already wired this).
Expected:
- Rows are now vulnerabilities (approved only, across CVE/Patch/EOS), not assets.
- Stats cards show 전체/CRITICAL/HIGH/미매핑 counts derived from approved notices.
- Search box filters by title/CVE/product/source.
- 상세 필터 아코디언 lets you filter by 심각도, 출처유형(전체/KISA/제조사), and 공지유형(전체/CVE/Patch/EOS).
- "공지 유형" column badge renders in a distinct color for EOS rows (uses the `eos` accent) vs CVE/Patch.
- Clicking "매핑 자산" on a row expands an inline sub-row listing matched assets (id · name · server · owner), or "매칭되는 자산이 없습니다" when there are none.
- Excel export downloads a file with the 8 listed columns including "공지 유형".
- "KISA 취약점 공지 바로가기" / "제조사 취약점 공지 바로가기" / "EOS 공지 바로가기" buttons navigate correctly.

- [ ] **Step 4: Commit**

```bash
git add components/pages/patch-view.tsx
git commit -m "refactor: patch-view.tsx becomes notice-centric 승인된 취약점 공지 board with 공지 유형 column"
```

---

### Task 10: Manual registration — `source_type` + collector defaults

**Files:**
- Modify: `components/pages/admin-view.tsx:235-354` (`ManualVulnFormValues`, `EMPTY_MANUAL_VULN`, `ManualVulnFormPanel`)
- Modify: `components/pages/admin-view.tsx:715-740` (`submitManualVuln`)
- Modify: `components/pages/admin-view.tsx:1079-1081` (helper text)
- Modify: `app/api/collect-source/route.ts:75-86` and `:151-162` (the two `notices.push({...})` call sites)

**Interfaces:**
- No new exports; this task only changes internal state/insert payloads. `notice_type` selection (`MANUAL_VULN_NOTICE_TYPES`, already includes `"EOS"`) is unchanged — it already lets an admin manually register an EOS notice; this task just adds the `source_type` (KISA/제조사) that determines whether it later shows in "KISA 취약점 공지"/"제조사 취약점 공지" vs "EOS 공지" (EOS notices show in "EOS 공지" regardless of `source_type`, per Task 7).

- [ ] **Step 1: Add `source_type` to the manual form's type and default**

In `components/pages/admin-view.tsx`, change (around line 235-253):

```ts
type ManualVulnFormValues = {
  cve: string
  title: string
  severity: VulnSeverity
  product: string
  source: string
  source_url: string
  notice_type: NoticeType
}

const EMPTY_MANUAL_VULN: ManualVulnFormValues = {
  cve: "",
  title: "",
  severity: "Medium",
  product: "",
  source: "",
  source_url: "",
  notice_type: "CVE",
}
```

to:

```ts
type SourceType = Tables<"vulnerabilities">["source_type"]
const MANUAL_VULN_SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "kisa", label: "KISA" },
  { value: "vendor", label: "제조사" },
]

type ManualVulnFormValues = {
  cve: string
  title: string
  severity: VulnSeverity
  product: string
  source: string
  source_url: string
  source_type: SourceType
  notice_type: NoticeType
}

const EMPTY_MANUAL_VULN: ManualVulnFormValues = {
  cve: "",
  title: "",
  severity: "Medium",
  product: "",
  source: "",
  source_url: "",
  source_type: "vendor",
  notice_type: "CVE",
}
```

- [ ] **Step 2: Add the radio buttons to `ManualVulnFormPanel`**

In `components/pages/admin-view.tsx`, right after the "출처" text input (the block ending at line 332, just before the "출처 URL (선택)" label at line 334), insert:

```tsx
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">출처 유형</span>
        <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5">
          {MANUAL_VULN_SOURCE_TYPES.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-xs text-foreground">
              <input
                type="radio"
                name="manual-vuln-source-type"
                checked={values.source_type === opt.value}
                onChange={() => setValues((v) => ({ ...v, source_type: opt.value }))}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </label>
```

- [ ] **Step 3: Include `source_type` in the insert payload**

In `components/pages/admin-view.tsx`, change `submitManualVuln` (around line 715-728):

```ts
  async function submitManualVuln(values: ManualVulnFormValues): Promise<boolean> {
    setManualVulnSubmitting(true)
    const supabase = createClient()
    const payload: TablesInsert<"vulnerabilities"> = {
      cve: values.cve.trim(),
      title: values.title.trim(),
      severity: values.severity,
      product: values.product.trim(),
      source: values.source.trim(),
      source_url: values.source_url.trim() || null,
      source_type: values.source_type,
      notice_type: values.notice_type,
      approval: "승인대기",
    }
    const { error } = await supabase.from("vulnerabilities").insert(payload)
```

- [ ] **Step 4: Update the helper text under the form**

In `components/pages/admin-view.tsx`, change (around line 1079-1081):

```tsx
          <p className="mt-3 text-[11px] text-muted-foreground">
            등록된 공지는 &apos;승인대기&apos; 상태로 KISA 취약점 공지 화면에 나타납니다. 그곳에서 검토 후 승인하면 전사 패치 모니터링에 반영됩니다.
          </p>
```

to:

```tsx
          <p className="mt-3 text-[11px] text-muted-foreground">
            등록된 공지는 &apos;승인대기&apos; 상태로 공지 유형에 맞는 화면(EOS는 'EOS 공지', 그 외는 출처 유형에 따라 'KISA 취약점 공지' 또는 '제조사 취약점 공지')에 나타납니다. 그곳에서 검토 후 승인하면 승인된 취약점 공지에 반영됩니다.
          </p>
```

- [ ] **Step 5: Update the success toast copy in `submitManualVuln`**

In `components/pages/admin-view.tsx`, change (around line 734-738):

```ts
    toast({
      title: "취약점/패치 공지가 등록되었습니다",
      description: "KISA 취약점 공지 화면에서 검토·승인해주세요.",
      tone: "success",
    })
```

to:

```ts
    toast({
      title: "취약점/패치 공지가 등록되었습니다",
      description:
        values.notice_type === "EOS"
          ? "EOS 공지 화면에서 검토·승인해주세요."
          : values.source_type === "kisa"
            ? "KISA 취약점 공지 화면에서 검토·승인해주세요."
            : "제조사 취약점 공지 화면에서 검토·승인해주세요.",
      tone: "success",
    })
```

- [ ] **Step 6: Set `source_type: "vendor"` on the two automated collectors**

In `app/api/collect-source/route.ts`, change the `notices.push({...})` inside `collectApacheTomcat` (around line 75-85):

```ts
      notices.push({
        cve: current.cve,
        title: current.title,
        severity,
        product: `Apache Tomcat ${affectsMatch ? affectsMatch[1].trim() : fixedVersion}`,
        source: "Apache Tomcat 공식 보안 공지",
        source_url: url,
        source_type: "vendor",
        notice_type: "CVE",
        mapped_assets: 0,
        collected_at: collectedAt.toISOString(),
      })
```

and the `notices.push({...})` inside `collectTmaxSoft` (around line 151-161 — note this is the collector that already produces `notice_type: "EOS"` rows for EOL/단종 titles, so those rows will now automatically appear on the new "EOS 공지" screen once `source_type` is added):

```ts
    notices.push({
      cve: key,
      title: row.title,
      severity: noticeType === "EOS" ? "High" : "High",
      product,
      source: "TmaxSoft 공식 기술공지",
      source_url: `https://www.tmaxsoft.com/kr/developer/notice/view?seq=${row.seq}&boardCd=notice`,
      source_type: "vendor",
      notice_type: noticeType,
      mapped_assets: 0,
      collected_at: collectedAt,
    })
```

- [ ] **Step 7: Type-check**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 8: Manual check**

Run: `pnpm dev`, open "관리자 페이지 > 수집 관리", use "패치/취약점 수동 등록":
- Register one row with 공지 유형 = EOS (any 출처 유형).
- Register one row with 공지 유형 = CVE, 출처 유형 = KISA.
- Register one row with 공지 유형 = CVE, 출처 유형 = 제조사.

Expected: the EOS one appears only in "EOS 공지" (regardless of its 출처 유형), the KISA/CVE one appears only in "KISA 취약점 공지", the 제조사/CVE one appears only in "제조사 취약점 공지". Then run "즉시 수집" for Apache Tomcat/JEUS/WebtoB (or check existing collected rows in Supabase) and confirm those rows have `source_type = 'vendor'`, and any TmaxSoft EOL rows (`notice_type = 'EOS'`) now show up on "EOS 공지" instead of "제조사 취약점 공지".

- [ ] **Step 9: Commit**

```bash
git add components/pages/admin-view.tsx app/api/collect-source/route.ts
git commit -m "feat: capture source_type on manual vulnerability registration and auto-collectors"
```

---

### Task 11: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: succeeds with no errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new errors introduced by this feature (pre-existing warnings elsewhere in the repo are out of scope).

- [ ] **Step 3: End-to-end manual walkthrough**

Run: `pnpm dev`, then as an admin (`RoleToggle` in the header set to 관리자):
1. Register a manual vulnerability with 공지 유형 = CVE, 출처 유형 = KISA, on an existing seeded product name (e.g. "Apache Tomcat").
2. Go to "KISA 취약점 공지" — confirm the new row appears with matched assets shown, approve it.
3. Confirm a `notifications` row was created (check the 알림 센터 bell icon / `notifications` table) with `link_view = "patch"` and label "승인된 취약점 공지로 이동".
4. Go to "승인된 취약점 공지" — confirm the approved KISA row appears, with 출처 유형 badge = KISA and 공지 유형 badge = CVE, and expanding "매핑 자산" shows the matched asset.
5. Register a second manual vulnerability with 공지 유형 = CVE, 출처 유형 = 제조사, go to "제조사 취약점 공지", reject it — confirm it disappears from both "제조사 취약점 공지" (now shows 반려) and does not appear in "승인된 취약점 공지".
6. Register a third manual vulnerability with 공지 유형 = EOS (either 출처 유형). Confirm it does **not** appear in "KISA 취약점 공지" or "제조사 취약점 공지", but does appear in "EOS 공지". Approve it there.
7. Go to "승인된 취약점 공지" — confirm the approved EOS row appears with a 공지 유형 = EOS badge, and that filtering "공지 유형" to "EOS" narrows the table to just this row (and any other approved EOS notices).
8. Switch role to 일반 사용자 (`RoleToggle`) — confirm KISA/제조사/EOS approve/reject buttons are hidden and replaced by "알림 수신 확인", and "승인된 취약점 공지" is still visible (no admin-only restriction).
9. Confirm the existing "EOS 로드맵" top-level nav item still works unchanged (shows `assets.eos` dates, unrelated to the new "EOS 공지" screen).

Expected: all steps behave as described with no console errors.

- [ ] **Step 4: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```

(Skip this commit if step 3 required no code changes.)
