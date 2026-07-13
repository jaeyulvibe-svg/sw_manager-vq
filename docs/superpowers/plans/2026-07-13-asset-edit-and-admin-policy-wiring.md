# 자산 관리 버튼 + 관리자 정책 토글 실연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up two sets of decorative UI controls to real Supabase data and logic: (1) `assets-view.tsx`'s per-row 수정/수집 buttons, and (2) `admin-view.tsx`'s 수집 관리/승인 정책 tab toggles — including making two of the policy toggles actually change the vulnerability auto-collection approval flow.

**Architecture:** A new singleton table `admin_policies` (one fixed row, id `'default'`) backs both admin tabs. A new shared server-safe module `lib/notice-approval.ts` holds the "flag matched assets + insert notifications" side effect so it can run from both the client-side manual-approve flow (`notice-actions.ts`) and the server-side auto-collect route (`app/api/collect-source/route.ts`) without duplicating logic. `assets-view.tsx` gets a `servers-view.tsx`-style inline edit panel and a real per-product recollect action.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (`@supabase/supabase-js` via `@supabase/ssr`), TypeScript, Tailwind.

## Global Constraints

- No test suite is configured in this repo (`CLAUDE.md`) — every "verify" step below is `npx tsc --noEmit` (filtered to touched files) plus a manual check, not an automated test run. Do not add a test framework as part of this plan.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true`, so `npx tsc --noEmit` is the only thing that will actually catch type errors — always run it before committing a task.
- This project has no Supabase CLI link and no DB connection string in `.env.local` (only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). SQL migration files are applied manually by the user pasting them into the Supabase SQL editor — Task 1 ends with a manual-apply instruction, not an automated migration run.
- Follow existing code conventions exactly: Korean UI strings, `MiniButton`/`SectionCard`/`StatusBadge` from `@/components/portal/ui`, `useToast()` for feedback, `cn()` from `@/lib/utils`, immediate-reflect CRUD (call `supabase` directly from the client component, no separate API layer) — this matches `servers-view.tsx` and `admin-view.tsx`'s existing Source URL/사용자 CRUD.
- Do not touch `admin_policies`' `auto_collect_enabled`/`collect_interval` beyond persisting the value — there is no server cron in this app, so these two fields are settings-only (confirmed with user).

---

### Task 1: `admin_policies` table + generated types

**Files:**
- Create: `supabase/migrations/012_admin_policies.sql`
- Modify: `lib/supabase/types.ts:371-401` (insert new table block after `app_users`, before the closing `}` of `Tables`)

**Interfaces:**
- Produces: `Tables<"admin_policies">` row shape — `{ id: string; auto_collect_enabled: boolean; collect_interval: "1시간"|"6시간"|"일 1회"; critical_urgent_alert: boolean; high_requires_approval: boolean; eos_alert_180d: boolean; queue_after_collect: boolean; updated_at: string }`. Every later task reads/writes this row via `id = "default"`.

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================
--  관리자 정책 설정 — 수집 관리 / 승인 정책 탭 실데이터 연동
--  (단일 행, id='default'. 서버 cron이 없어 auto_collect_enabled/
--   collect_interval은 값만 저장하고 실제 주기 실행은 하지 않는다.)
-- =====================================================

create table if not exists public.admin_policies (
  id                      text primary key default 'default',
  auto_collect_enabled    boolean not null default true,
  collect_interval        text not null default '일 1회' check (collect_interval in ('1시간','6시간','일 1회')),
  critical_urgent_alert   boolean not null default true,
  high_requires_approval  boolean not null default true,
  eos_alert_180d          boolean not null default true,
  queue_after_collect     boolean not null default true,
  updated_at              timestamptz not null default now()
);

drop trigger if exists admin_policies_updated_at on public.admin_policies;
create trigger admin_policies_updated_at
  before update on public.admin_policies
  for each row execute function public.set_updated_at();

alter table public.admin_policies enable row level security;

drop policy if exists "allow_all_admin_policies" on public.admin_policies;
create policy "allow_all_admin_policies" on public.admin_policies for all using (true) with check (true);

insert into public.admin_policies (id) values ('default')
on conflict (id) do nothing;
```

- [ ] **Step 2: Add the `admin_policies` table type to `lib/supabase/types.ts`**

Open `lib/supabase/types.ts`. Find the `app_users` block, which ends like this (currently lines 371-401):

```ts
      app_users: {
        Row: {
          id: string
          name: string
          email: string
          dept: string
          role: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          dept: string
          role: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          email?: string
          dept?: string
          role?: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
```

Insert a new `admin_policies` block right after the `app_users` block's closing `}`, before the `Tables` object's own closing `}`:

```ts
      app_users: {
        Row: {
          id: string
          name: string
          email: string
          dept: string
          role: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          dept: string
          role: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          email?: string
          dept?: string
          role?: "관리자" | "승인자" | "담당자" | "조회 사용자"
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      admin_policies: {
        Row: {
          id: string
          auto_collect_enabled: boolean
          collect_interval: "1시간" | "6시간" | "일 1회"
          critical_urgent_alert: boolean
          high_requires_approval: boolean
          eos_alert_180d: boolean
          queue_after_collect: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          auto_collect_enabled?: boolean
          collect_interval?: "1시간" | "6시간" | "일 1회"
          critical_urgent_alert?: boolean
          high_requires_approval?: boolean
          eos_alert_180d?: boolean
          queue_after_collect?: boolean
          updated_at?: string
        }
        Update: {
          auto_collect_enabled?: boolean
          collect_interval?: "1시간" | "6시간" | "일 1회"
          critical_urgent_alert?: boolean
          high_requires_approval?: boolean
          eos_alert_180d?: boolean
          queue_after_collect?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "lib/supabase/types.ts"`
Expected: no output (no errors in this file).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_admin_policies.sql lib/supabase/types.ts
git commit -m "feat: add admin_policies table for collect/approval policy persistence"
```

- [ ] **Step 5: Tell the user to apply the migration**

Tell the user: "`012_admin_policies.sql`을 Supabase SQL 편집기에서 실행해주세요 — 이 프로젝트는 CLI 연결이 없어서 이전 마이그레이션들과 동일하게 수동 적용이 필요합니다." Do not proceed to treat the table as live until the user confirms it's applied — later tasks' manual-verification steps assume the table exists.

---

### Task 2: Shared approval side-effects + policy-aware `approveNotice`

**Files:**
- Create: `lib/notice-approval.ts`
- Modify: `components/pages/notice-board/notice-actions.ts` (full rewrite, currently 50 lines)

**Interfaces:**
- Consumes: `Tables<"vulnerabilities">`, `Tables<"assets">` from `@/lib/supabase/types` (Task 1 unaffected — these already exist).
- Produces: `ApprovalPolicy = { criticalUrgentAlert: boolean }`, `flagMatchedAssetsAndNotify(supabase, notice, matched, policy): Promise<{ notifiedCount: number }>`, `applyNoticeApproval(supabase, v, matched, policy): Promise<{ notifiedCount: number }>` from `lib/notice-approval.ts`. Task 3 calls `approveNotice(v, matched, policy)` (now 3 args, was 2). Task 4 calls `flagMatchedAssetsAndNotify` directly.

- [ ] **Step 1: Create `lib/notice-approval.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/supabase/types"

type Vulnerability = Tables<"vulnerabilities">
type Asset = Tables<"assets">

export type ApprovalPolicy = {
  criticalUrgentAlert: boolean
}

/**
 * 매칭된 자산을 '확인필요'로 플래그하고 담당자에게 알림을 생성한다.
 * Critical 등급 공지는 policy.criticalUrgentAlert가 false면 알림을 건너뛴다.
 */
export async function flagMatchedAssetsAndNotify(
  supabase: SupabaseClient<Database>,
  notice: Pick<Vulnerability, "title" | "cve" | "severity" | "notice_type">,
  matched: Asset[],
  policy: ApprovalPolicy,
): Promise<{ notifiedCount: number }> {
  if (matched.length === 0) return { notifiedCount: 0 }

  const toFlag = matched
    .filter((a) => a.approval !== "승인완료" && a.approval !== "긴급")
    .map((a) => a.id)
  if (toFlag.length > 0) {
    await supabase.from("assets").update({ approval: "확인필요" }).in("id", toFlag)
  }

  if (notice.severity === "Critical" && !policy.criticalUrgentAlert) {
    return { notifiedCount: 0 }
  }

  const isEos = notice.notice_type === "EOS"
  await supabase.from("notifications").insert(
    matched.map((a) => ({
      category: "security" as const,
      title: isEos ? `${notice.title} 관련 지원종료(EOS) 대응 필요` : `${notice.title} 관련 패치 필요`,
      description: isEos
        ? `${a.name} (${a.server}) 자산의 제품이 지원종료(EOS) 대상입니다. ${notice.cve} 공지를 확인하고 교체·업그레이드 등 후속 조치를 계획해주세요.`
        : `${a.name} (${a.server}) 자산에 ${notice.cve} 관련 보안 패치 적용이 필요합니다. 확인 후 조치해주세요.`,
      asset: `${a.name} ${a.version}`,
      owner: a.owner,
      status: "확인필요" as const,
      urgent: notice.severity === "Critical",
      link_view: "patch",
      link_label: "승인된 취약점 공지로 이동",
    })),
  )

  return { notifiedCount: matched.length }
}

/** 이미 존재하는 공지 행을 승인 처리 (수동 승인 버튼 경로). */
export async function applyNoticeApproval(
  supabase: SupabaseClient<Database>,
  v: Pick<Vulnerability, "id" | "title" | "cve" | "severity" | "notice_type">,
  matched: Asset[],
  policy: ApprovalPolicy,
): Promise<{ notifiedCount: number }> {
  await supabase
    .from("vulnerabilities")
    .update({ approval: "승인완료", mapped_assets: matched.length })
    .eq("id", v.id)

  return flagMatchedAssetsAndNotify(supabase, v, matched, policy)
}
```

- [ ] **Step 2: Rewrite `components/pages/notice-board/notice-actions.ts`**

```ts
"use client"

import { createClient } from "@/lib/supabase/client"
import { applyNoticeApproval, type ApprovalPolicy } from "@/lib/notice-approval"
import type { Asset, Vulnerability } from "./use-notice-data"

export async function approveNotice(
  v: Vulnerability,
  matched: Asset[],
  policy: ApprovalPolicy,
): Promise<{ notifiedCount: number }> {
  const supabase = createClient()
  return applyNoticeApproval(supabase, v, matched, policy)
}

export async function rejectNotice(v: Vulnerability): Promise<void> {
  const supabase = createClient()
  await supabase.from("vulnerabilities").update({ approval: "반려" }).eq("id", v.id)
}
```

- [ ] **Step 3: Typecheck (expect a pre-existing error in the caller, fixed in Task 3)**

Run: `npx tsc --noEmit -p . 2>&1 | grep "notice-actions\|notice-approval"`
Expected: no errors from `notice-approval.ts` or `notice-actions.ts` itself. (`notice-review-board.tsx` will show a "expected 3 arguments" error until Task 3 — that's fine, don't fix it here.)

- [ ] **Step 4: Commit**

```bash
git add lib/notice-approval.ts components/pages/notice-board/notice-actions.ts
git commit -m "refactor: extract shared notice-approval side effects into lib/notice-approval.ts"
```

---

### Task 3: `NoticeReviewBoard` loads policy and passes it to `approveNotice`

**Files:**
- Modify: `components/pages/notice-board/notice-review-board.tsx`

**Interfaces:**
- Consumes: `approveNotice(v, matched, policy: ApprovalPolicy)` from Task 2. `Tables<"admin_policies">` from Task 1.
- Produces: nothing new consumed by later tasks (leaf change).

- [ ] **Step 1: Add policy state and load it on mount**

In `components/pages/notice-board/notice-review-board.tsx`, add to the imports:

```ts
import { createClient } from "@/lib/supabase/client"
```

(add this line among the existing imports, e.g. right after the `"use client"` / `useState` import line)

Then, inside `NoticeReviewBoard`, right after the existing `const [busyId, setBusyId] = useState<string | null>(null)` line, add:

```ts
  const [criticalUrgentAlert, setCriticalUrgentAlert] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("admin_policies")
      .select("critical_urgent_alert")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCriticalUrgentAlert(data.critical_urgent_alert)
      })
  }, [])
```

This requires `useEffect` — update the top import from `import { useState } from "react"` to `import { useEffect, useState } from "react"`.

- [ ] **Step 2: Pass the policy into `approveNotice`**

Find `handleApprove`:

```ts
  async function handleApprove(v: Vulnerability) {
    if (busyId) return
    setBusyId(v.id)
    const matched = matchMap.get(v.id) ?? []
    const { notifiedCount } = await approveNotice(v, matched)
```

Change the `approveNotice` call to:

```ts
  async function handleApprove(v: Vulnerability) {
    if (busyId) return
    setBusyId(v.id)
    const matched = matchMap.get(v.id) ?? []
    const { notifiedCount } = await approveNotice(v, matched, { criticalUrgentAlert })
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "notice-review-board"`
Expected: no output.

- [ ] **Step 4: Manual verification**

Run `pnpm dev`, sign in as admin, open "제조사 취약점 공지", approve any pending notice with matched assets. Confirm the toast still reports notified count as before (default policy value is `true`, so behavior is unchanged from before this plan).

- [ ] **Step 5: Commit**

```bash
git add components/pages/notice-board/notice-review-board.tsx
git commit -m "feat: load critical_urgent_alert policy and pass it to approveNotice"
```

---

### Task 4: `/api/collect-source` auto-approves per policy

**Files:**
- Modify: `app/api/collect-source/route.ts`

**Interfaces:**
- Consumes: `flagMatchedAssetsAndNotify`, `ApprovalPolicy` from `lib/notice-approval.ts` (Task 2); `matchAssets` from `@/lib/vuln-match` (pre-existing).
- Produces: no new exports consumed elsewhere — this is the server-side end of the `high_requires_approval`/`queue_after_collect` policy wiring.

- [ ] **Step 1: Add policy fetch + auto-approve decision helpers**

In `app/api/collect-source/route.ts`, replace the existing types import line:

```ts
import type { Database, TablesInsert } from "@/lib/supabase/types"
```

with:

```ts
import type { Database, TablesInsert, Tables } from "@/lib/supabase/types"
import { matchAssets } from "@/lib/vuln-match"
import { flagMatchedAssetsAndNotify, type ApprovalPolicy } from "@/lib/notice-approval"
```

Right after the `supabaseAdmin()` function definition, add:

```ts
type CollectPolicy = ApprovalPolicy & {
  highRequiresApproval: boolean
  queueAfterCollect: boolean
}

const DEFAULT_POLICY: CollectPolicy = {
  criticalUrgentAlert: true,
  highRequiresApproval: true,
  queueAfterCollect: true,
}

async function fetchPolicy(supabase: ReturnType<typeof supabaseAdmin>): Promise<CollectPolicy> {
  try {
    const { data } = await supabase
      .from("admin_policies")
      .select("critical_urgent_alert, high_requires_approval, queue_after_collect")
      .eq("id", "default")
      .maybeSingle()
    if (!data) return DEFAULT_POLICY
    return {
      criticalUrgentAlert: data.critical_urgent_alert,
      highRequiresApproval: data.high_requires_approval,
      queueAfterCollect: data.queue_after_collect,
    }
  } catch {
    return DEFAULT_POLICY
  }
}

function shouldAutoApprove(severity: FoundNotice["severity"], policy: CollectPolicy): boolean {
  if (!policy.queueAfterCollect) return true
  if (!policy.highRequiresApproval && (severity === "Medium" || severity === "Low")) return true
  return false
}
```

- [ ] **Step 2: Rewrite `collectOne` to auto-approve eligible rows**

Find the current `collectOne` function:

```ts
async function collectOne(product: CollectProduct): Promise<CollectResult> {
  try {
    const supabase = supabaseAdmin()
    const rawFound = await fetchForProduct(product)

    // 동일 CVE가 여러 버전 섹션에 걸쳐 반복 언급될 수 있으므로 배치 내에서도 cve 기준 중복 제거.
    const found = Array.from(new Map(rawFound.map((n) => [n.cve, n])).values())

    if (found.length === 0) {
      return { product, ok: true, newCount: 0 }
    }

    const { data: existing, error: selErr } = await supabase
      .from("vulnerabilities")
      .select("cve")
      .in("cve", found.map((n) => n.cve))
    if (selErr) throw selErr

    const existingCves = new Set((existing ?? []).map((r) => r.cve))
    const toInsert = found.filter((n) => !existingCves.has(n.cve))

    if (toInsert.length === 0) {
      return { product, ok: true, newCount: 0 }
    }

    const { error: insErr } = await supabase.from("vulnerabilities").insert(toInsert)
    if (insErr) throw insErr

    return { product, ok: true, newCount: toInsert.length }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err)
    console.error(`collect-source failed for ${product}:`, err)
    return { product, ok: false, newCount: 0, error: message }
  }
}
```

Replace it with:

```ts
async function collectOne(
  product: CollectProduct,
  policy: CollectPolicy,
  assets: Tables<"assets">[],
): Promise<CollectResult> {
  try {
    const supabase = supabaseAdmin()
    const rawFound = await fetchForProduct(product)

    // 동일 CVE가 여러 버전 섹션에 걸쳐 반복 언급될 수 있으므로 배치 내에서도 cve 기준 중복 제거.
    const found = Array.from(new Map(rawFound.map((n) => [n.cve, n])).values())

    if (found.length === 0) {
      return { product, ok: true, newCount: 0 }
    }

    const { data: existing, error: selErr } = await supabase
      .from("vulnerabilities")
      .select("cve")
      .in("cve", found.map((n) => n.cve))
    if (selErr) throw selErr

    const existingCves = new Set((existing ?? []).map((r) => r.cve))
    const toInsert = found.filter((n) => !existingCves.has(n.cve))

    if (toInsert.length === 0) {
      return { product, ok: true, newCount: 0 }
    }

    const prepared = toInsert.map((notice) => {
      const matched = matchAssets(notice, assets)
      const autoApprove = shouldAutoApprove(notice.severity, policy)
      return {
        // notice_type is optional on the Insert type but every collector above always sets it —
        // fall back to "CVE" only to satisfy the stricter (non-optional) shape flagMatchedAssetsAndNotify expects.
        notice: {
          title: notice.title,
          cve: notice.cve,
          severity: notice.severity,
          notice_type: notice.notice_type ?? "CVE",
        },
        matched,
        row: {
          ...notice,
          approval: autoApprove ? ("승인완료" as const) : ("승인대기" as const),
          mapped_assets: autoApprove ? matched.length : 0,
        },
      }
    })

    const { error: insErr } = await supabase.from("vulnerabilities").insert(prepared.map((p) => p.row))
    if (insErr) throw insErr

    for (const { notice, matched, row } of prepared) {
      if (row.approval !== "승인완료") continue
      await flagMatchedAssetsAndNotify(supabase, notice, matched, policy)
    }

    return { product, ok: true, newCount: toInsert.length }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err)
    console.error(`collect-source failed for ${product}:`, err)
    return { product, ok: false, newCount: 0, error: message }
  }
}
```

- [ ] **Step 3: Fetch policy + assets once per request and pass them into `collectOne`**

Find the `POST` handler:

```ts
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const products: CollectProduct[] = Array.isArray(body?.products) ? body.products : []

  const validProducts = products.filter(
    (p): p is CollectProduct => COLLECT_PRODUCTS.includes(p as CollectProduct),
  )

  if (validProducts.length === 0) {
    return NextResponse.json(
      { error: `products must include at least one of ${COLLECT_PRODUCTS.join(", ")}` },
      { status: 400 },
    )
  }

  const results = await Promise.all(validProducts.map(collectOne))
  return NextResponse.json({ results })
}
```

Replace the last two lines with:

```ts
  const supabase = supabaseAdmin()
  const [policy, assetsRes] = await Promise.all([
    fetchPolicy(supabase),
    supabase.from("assets").select("*"),
  ])
  const assets = assetsRes.data ?? []

  const results = await Promise.all(validProducts.map((p) => collectOne(p, policy, assets)))
  return NextResponse.json({ results })
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "collect-source"`
Expected: no output.

- [ ] **Step 5: Manual verification**

This step requires Task 1's migration applied. With `pnpm dev` running:
1. In Supabase, confirm `admin_policies.high_requires_approval = true`, `queue_after_collect = true` (defaults) — trigger "즉시 수집" from the admin page, confirm newly collected notices still land as `승인대기` (unchanged from before).
2. Set `queue_after_collect = false` directly in Supabase, delete a couple of recently-collected test rows from `vulnerabilities` so they can be re-collected, run "즉시 수집" again, confirm the newly-inserted rows have `approval = '승인완료'` and (if a matching asset exists) a `notifications` row was created.
3. Reset `queue_after_collect = true`.

- [ ] **Step 6: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "feat: gate auto-collected notice approval behind admin_policies"
```

---

### Task 5: `admin-view.tsx` — controlled `Toggle` + policy load/save + 수집 관리 탭

**Files:**
- Modify: `components/pages/admin-view.tsx`

**Interfaces:**
- Consumes: `Tables<"admin_policies">`, `TablesUpdate<"admin_policies">` from `@/lib/supabase/types` (Task 1).
- Produces: `policy` state (`Tables<"admin_policies"> | null`) and `updatePolicy(patch: Partial<TablesUpdate<"admin_policies">>)` function — Task 6 and Task 7 both use these (same component, later tasks in this file build on this state).

- [ ] **Step 1: Make `Toggle` a controlled component**

Find the `Toggle` function (currently around line 624):

```ts
function Toggle({
  label,
  desc,
  defaultOn = false,
}: {
  label: string
  desc: string
  defaultOn?: boolean
}) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-[left]",
            on ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  )
}
```

Replace it with:

```ts
function Toggle({
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-[left]",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add policy state + load/save functions**

Find this block near the top of `AdminView` (currently lines 672-678):

```ts
export function AdminView({ initialTab }: { initialTab: AdminTab }) {
  const activeTab = initialTab
  const [collecting, setCollecting] = useState(false)
  const [collectLog, setCollectLog] = useState<CollectLogEntry[]>([])
  const [fontScale, setFontScale] = useState(FONT_SCALE_DEFAULT)
  const { isAdmin } = useRole()
  const { toast } = useToast()
```

Add policy state right after `const { toast } = useToast()`. Add `TablesUpdate` to the existing `import type { Tables, TablesInsert } from "@/lib/supabase/types"` line (it becomes `import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/types"`) — `updatePolicy`'s parameter must be typed as `Partial<TablesUpdate<"admin_policies">>`, not `Partial<Tables<"admin_policies">>`: the Row shape (`Tables`) includes `id`, which the generated `Update` type structurally rejects, so the `Tables` version does not typecheck.

```ts
  const [policy, setPolicy] = useState<Tables<"admin_policies"> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("admin_policies")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPolicy(data)
      })
  }, [])

  async function updatePolicy(patch: Partial<TablesUpdate<"admin_policies">>) {
    if (!policy) return
    const previous = policy
    setPolicy({ ...policy, ...patch })
    const supabase = createClient()
    const { error } = await supabase.from("admin_policies").update(patch).eq("id", "default")
    if (error) {
      setPolicy(previous)
      toast({ title: "설정 저장 실패", description: error.message, tone: "danger" })
    }
  }
```

- [ ] **Step 3: Wire 수집 관리 탭's 자동 수집 스케줄러 토글 + 수집 주기 셀렉트**

Find (currently around lines 1289-1301):

```tsx
          <div className="flex flex-col gap-3">
            <Toggle label="자동 수집 스케줄러" desc="공식 Source 주기적 자동 수집" defaultOn />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">수집 주기</p>
                <p className="text-xs text-muted-foreground">기본 수집 인터벌</p>
              </div>
              <select className="shrink-0 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none">
                <option>1시간</option>
                <option>6시간</option>
                <option>일 1회</option>
              </select>
            </div>
```

Replace with:

```tsx
          <div className="flex flex-col gap-3">
            <Toggle
              label="자동 수집 스케줄러"
              desc="공식 Source 주기적 자동 수집 (설정값만 저장 — 이 앱은 서버 스케줄러가 없어 실제 주기 실행은 수동 '즉시 수집'으로 대체됩니다)"
              checked={policy?.auto_collect_enabled ?? true}
              disabled={!policy}
              onChange={(next) => updatePolicy({ auto_collect_enabled: next })}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">수집 주기</p>
                <p className="text-xs text-muted-foreground">기본 수집 인터벌 (설정값만 저장)</p>
              </div>
              <select
                value={policy?.collect_interval ?? "일 1회"}
                disabled={!policy}
                onChange={(e) => updatePolicy({ collect_interval: e.target.value as Tables<"admin_policies">["collect_interval"] })}
                className="shrink-0 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="1시간">1시간</option>
                <option value="6시간">6시간</option>
                <option value="일 1회">일 1회</option>
              </select>
            </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "admin-view"`
Expected: errors referencing the 승인 정책 탭's remaining `<Toggle ... defaultOn />` usages (missing `checked`/`onChange`) — that's expected, fixed in Task 6. No other errors should appear.

- [ ] **Step 5: Manual verification**

Run `pnpm dev`, open 관리자 페이지 › 수집 관리. Toggle "자동 수집 스케줄러" off, change "수집 주기" to "1시간", refresh the page — both values should still reflect your change (persisted).

- [ ] **Step 6: Commit**

```bash
git add components/pages/admin-view.tsx
git commit -m "feat: persist 수집 관리 탭 설정 to admin_policies"
```

---

### Task 6: `admin-view.tsx` — 승인 정책 탭 토글 4개 연동

**Files:**
- Modify: `components/pages/admin-view.tsx`

**Interfaces:**
- Consumes: `policy`/`updatePolicy` from Task 5 (same component, no new exports).

- [ ] **Step 1: Wire the four policy toggles**

Find (currently around lines 1389-1398):

```tsx
      {activeTab === "policy" && (
      <SectionCard title="승인 정책 관리" subtitle="자동 알림 및 승인 규칙" icon={ShieldCheck}>
        <div className="flex flex-col gap-3">
          <Toggle label="Critical 자동 긴급 알림" desc="Critical 취약점 발견 시 즉시 알림" defaultOn />
          <Toggle label="High 이상 관리자 승인 필수" desc="High 등급 이상 패치는 관리자 승인" defaultOn />
          <Toggle label="EOS 180일 전 알림" desc="지원 종료 180일 전 담당자 알림" defaultOn />
          <Toggle label="패치 공지 수집 후 승인 대기 등록" desc="수집된 공지를 자동으로 승인 대기 큐에 등록" />
        </div>
      </SectionCard>
      )}
```

Replace with:

```tsx
      {activeTab === "policy" && (
      <SectionCard title="승인 정책 관리" subtitle="자동 알림 및 승인 규칙" icon={ShieldCheck}>
        <div className="flex flex-col gap-3">
          <Toggle
            label="Critical 자동 긴급 알림"
            desc="Critical 취약점 승인 시 담당자에게 즉시 알림 (끄면 Critical 승인 시 알림을 생성하지 않습니다)"
            checked={policy?.critical_urgent_alert ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ critical_urgent_alert: next })}
          />
          <Toggle
            label="High 이상 관리자 승인 필수"
            desc="켜면(기본) 모든 등급이 수동 승인 필요. 끄면 즉시 수집으로 들어온 Medium/Low 공지는 자동 승인됩니다(High/Critical은 항상 수동 승인)"
            checked={policy?.high_requires_approval ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ high_requires_approval: next })}
          />
          <Toggle
            label="EOS 180일 전 알림"
            desc="지원 종료 180일 이내 자산을 관리자 페이지 접속 시 확인해 담당자에게 1회 알림"
            checked={policy?.eos_alert_180d ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ eos_alert_180d: next })}
          />
          <Toggle
            label="패치 공지 수집 후 승인 대기 등록"
            desc="켜면(기본) 즉시 수집 결과가 승인 대기 큐로 들어감. 끄면 심각도 무관 즉시 승인완료 처리(수동 등록은 영향 없음)"
            checked={policy?.queue_after_collect ?? true}
            disabled={!policy}
            onChange={(next) => updatePolicy({ queue_after_collect: next })}
          />
        </div>
      </SectionCard>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "admin-view"`
Expected: no output.

- [ ] **Step 3: Manual verification**

Run `pnpm dev`, open 관리자 페이지 › 승인 정책. Toggle each switch, refresh — all four should persist. Turn off "High 이상 관리자 승인 필수", run "즉시 수집" (수집 관리 탭), confirm any newly-collected Medium/Low notices show as `승인완료` in "제조사 취약점 공지"/"KISA 취약점 공지" while High/Critical still show `승인대기`. Turn it back on afterward.

- [ ] **Step 4: Commit**

```bash
git add components/pages/admin-view.tsx
git commit -m "feat: wire 승인 정책 탭 토글 to admin_policies and auto-approval logic"
```

---

### Task 7: `admin-view.tsx` — EOS 180일 전 지연 알림 체크

**Files:**
- Modify: `components/pages/admin-view.tsx`

**Interfaces:**
- Consumes: `policy` (Task 5), existing `assets` state (already loaded in `AdminView`, see the `useEffect` that does `supabase.from("assets").select("*")`).

- [ ] **Step 1: Add the lazy EOS check effect**

Find the existing assets-loading effect (currently around lines 735-744):

```ts
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("assets")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setAssets(data)
      })
  }, [])
```

Right after this `useEffect` block, add a new effect:

```ts
  useEffect(() => {
    if (!policy?.eos_alert_180d || assets.length === 0) return
    const now = Date.now()
    const horizon = now + 180 * 86400000
    const due = assets.filter((a) => {
      if (!a.eos) return false
      const t = new Date(a.eos).getTime()
      return t >= now && t <= horizon
    })
    if (due.length === 0) return

    const titleFor = (a: Tables<"assets">) => `${a.name} 지원종료(EOS) 180일 전 알림`
    const supabase = createClient()
    supabase
      .from("notifications")
      .select("title")
      .in("title", due.map(titleFor))
      .then(({ data }) => {
        const existing = new Set((data ?? []).map((n) => n.title))
        const toInsert = due
          .filter((a) => !existing.has(titleFor(a)))
          .map((a) => ({
            category: "security" as const,
            title: titleFor(a),
            description: `${a.name} (${a.server}) 자산의 지원종료(EOS) 예정일이 ${a.eos}로, 180일 이내입니다. 교체·업그레이드 계획을 검토해주세요.`,
            asset: `${a.name} ${a.version}`,
            owner: a.owner,
            status: "확인필요" as const,
            urgent: false,
            link_view: "eos",
            link_label: "EOS 로드맵에서 보기",
          }))
        if (toInsert.length > 0) {
          supabase.from("notifications").insert(toInsert).then()
        }
      })
  }, [policy?.eos_alert_180d, assets])
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "admin-view"`
Expected: no output.

- [ ] **Step 3: Manual verification**

In Supabase, temporarily set one asset's `eos` to a date ~90 days from now. Open 관리자 페이지 (any tab) with `pnpm dev` running — confirm a new row appears in `notifications` titled `"<자산명> 지원종료(EOS) 180일 전 알림"`, and that it shows up in the notification bell for that asset's owner. Reload the admin page again — confirm no duplicate row is created. Revert the test `eos` value afterward.

- [ ] **Step 4: Commit**

```bash
git add components/pages/admin-view.tsx
git commit -m "feat: lazy-check EOS 180-day reminders on admin page load"
```

---

### Task 8: `assets-view.tsx` — 행별 "수정" 편집 패널

**Files:**
- Modify: `components/pages/assets-view.tsx`

**Interfaces:**
- Produces: nothing consumed by later tasks (Task 9 is independent).

- [ ] **Step 1: Add the edit form panel component**

In `components/pages/assets-view.tsx`, add this new component right after the `toDetail` function (currently ends around line 107, before `/* ── 메인 컴포넌트 ── */`):

```ts
/* ── 행별 수정 패널 (담당자/설치 서버/승인 상태만) ─────────── */
type AssetEditValues = { owner: string; server: string; approval: Asset["approval"] }
const APPROVAL_OPTIONS: Asset["approval"][] = ["승인대기", "확인필요", "승인완료", "긴급"]

function AssetEditFormPanel({
  initial,
  servers,
  onCancel,
  onSubmit,
}: {
  initial: AssetEditValues
  servers: Server[]
  onCancel: () => void
  onSubmit: (values: AssetEditValues) => void
}) {
  const [values, setValues] = useState<AssetEditValues>(initial)
  const inputCls =
    "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">담당자</span>
        <input
          value={values.owner}
          onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">설치 서버</span>
        <select
          value={values.server}
          onChange={(e) => setValues((v) => ({ ...v, server: e.target.value }))}
          className={inputCls}
        >
          {servers.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">승인 상태</span>
        <select
          value={values.approval}
          onChange={(e) => setValues((v) => ({ ...v, approval: e.target.value as Asset["approval"] }))}
          className={inputCls}
        >
          {APPROVAL_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(values)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          취소
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add edit state + save function inside `AssetsView`**

Find (currently lines 121-122):

```ts
  const [selected, setSelected] = useState<AssetDetail | null>(null)
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false)
```

Add right after:

```ts
  const [editPanel, setEditPanel] = useState<string | null>(null)
```

Then find the `useEffect` that loads assets/servers (currently lines 124-134):

```ts
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("servers").select("*"),
    ]).then(([assetRes, serverRes]) => {
      if (assetRes.data) setAssets(assetRes.data)
      if (serverRes.data) setServers(serverRes.data)
      setLoading(false)
    })
  }, [])
```

Right after this block, add the save function:

```ts
  async function saveAssetEdit(assetId: string, values: AssetEditValues) {
    const supabase = createClient()
    const { error } = await supabase.from("assets").update(values).eq("id", assetId)
    if (error) {
      toast({ tone: "danger", title: "자산 수정 실패", description: error.message })
      return
    }
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...values } : a)))
    setEditPanel(null)
    toast({ tone: "success", title: "자산 정보가 수정되었습니다" })
  }
```

- [ ] **Step 3: Render the edit panel in place of the row, wire the 수정 button**

Find the table body map (currently lines 323-394), specifically its start:

```tsx
            {pagination.pageItems.map((a) => {
              const sv = servers.find((s) => s.name === a.server)
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
```

Change to:

```tsx
            {pagination.pageItems.map((a) => {
              const sv = servers.find((s) => s.name === a.server)
              if (editPanel === a.id) {
                return (
                  <tr key={a.id}>
                    <td colSpan={visible.length + 1} className="border-b border-border/40 p-0">
                      <AssetEditFormPanel
                        initial={{ owner: a.owner, server: a.server, approval: a.approval }}
                        servers={servers}
                        onCancel={() => setEditPanel(null)}
                        onSubmit={(values) => saveAssetEdit(a.id, values)}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
```

Then find the 수정 button (currently line 382):

```tsx
                      <MiniButton accent="muted"><Pencil className="h-3 w-3" />수정</MiniButton>
```

Replace with:

```tsx
                      <MiniButton accent="muted" onClick={() => setEditPanel(a.id)}>
                        <Pencil className="h-3 w-3" />수정
                      </MiniButton>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "assets-view"`
Expected: no output (Task 9 touches the same file next — some overlap is fine, just make sure there are no errors after this step alone).

- [ ] **Step 5: Manual verification**

Run `pnpm dev`, open 자산 관리, click 수정 on any row, change 담당자, pick a different 설치 서버, change 승인 상태, save. Confirm the row updates immediately and the value survives a page refresh.

- [ ] **Step 6: Commit**

```bash
git add components/pages/assets-view.tsx
git commit -m "feat: wire assets-view 수정 button to a real owner/server/approval edit panel"
```

---

### Task 9: `assets-view.tsx` — 행별 "수집" 실연동

**Files:**
- Modify: `components/pages/assets-view.tsx`

**Interfaces:**
- Consumes: `/api/collect-source` POST endpoint (pre-existing, `{ products: string[] }` → `{ results: { product, ok, newCount, error? }[] }`).

- [ ] **Step 1: Add tracked-products set + collect function**

Find the helper section near the top of the file (currently around lines 68-96, the `isEosSoon`/`isEosExpired`/etc. helpers). Add this constant right after the `ALL_COLS`/`FACTORY_VISIBLE` block (currently lines 47-51, before `/* ── 필터 옵션 ── */`):

```ts
/* ── 자동 수집 추적 대상 제품 (app/api/collect-source/route.ts와 동일 목록, KISA 제외) ── */
const TRACKED_COLLECT_PRODUCTS = new Set([
  "Apache Tomcat", "JEUS", "WebtoB", "Nginx",
  "PostgreSQL", "OpenSSL", "Red Hat Enterprise Linux", "Oracle Database",
])
```

- [ ] **Step 2: Add `collectingId` state + `collectAsset` function**

In `AssetsView`, right after the `editPanel` state added in Task 8:

```ts
  const [editPanel, setEditPanel] = useState<string | null>(null)
  const [collectingId, setCollectingId] = useState<string | null>(null)
```

Right after the `saveAssetEdit` function added in Task 8, add:

```ts
  async function collectAsset(asset: Asset) {
    if (collectingId) return
    if (!TRACKED_COLLECT_PRODUCTS.has(asset.name)) {
      toast({
        tone: "info",
        title: "자동 수집 대상 제품이 아닙니다",
        description: `${asset.name}은(는) 자동 수집 추적 대상 제품 목록에 없습니다.`,
      })
      return
    }
    setCollectingId(asset.id)
    try {
      const res = await fetch("/api/collect-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: [asset.name] }),
      })
      const data = await res.json()
      const result = (data.results ?? [])[0]
      const supabase = createClient()
      const nowIso = new Date().toISOString()
      const { error } = await supabase.from("assets").update({ checked_at: nowIso }).eq("id", asset.id)
      if (error) {
        toast({ tone: "danger", title: "확인일 갱신 실패", description: error.message })
        return
      }
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, checked_at: nowIso } : a)))
      toast({
        tone: "success",
        title: "자산 정보 수집 완료",
        description:
          result?.ok
            ? `${asset.name} 신규 공지 ${result.newCount}건 확인, 확인일이 갱신되었습니다.`
            : `${asset.name} 수집 중 오류가 발생했지만 확인일은 갱신되었습니다.`,
      })
    } catch {
      toast({ tone: "danger", title: "수집 실패", description: "네트워크 오류로 수집에 실패했습니다." })
    } finally {
      setCollectingId(null)
    }
  }
```

- [ ] **Step 3: Wire the 수집 button**

Find the 수집 button (currently lines 383-389, right after the 수정 button touched in Task 8):

```tsx
                      <MiniButton accent="success" onClick={() => toast({
                        tone: "info",
                        title: "자산 정보 수집 시작",
                        description: `${a.name} (${a.server}) 최신 버전/패치 상태를 수집합니다.`,
                      })}>
                        <RefreshCw className="h-3 w-3" />수집
                      </MiniButton>
```

Replace with:

```tsx
                      <MiniButton
                        accent="success"
                        disabled={collectingId === a.id}
                        onClick={() => collectAsset(a)}
                      >
                        <RefreshCw className={cn("h-3 w-3", collectingId === a.id && "animate-spin")} />
                        {collectingId === a.id ? "수집 중…" : "수집"}
                      </MiniButton>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "assets-view"`
Expected: no output.

- [ ] **Step 5: Manual verification**

Run `pnpm dev`, open 자산 관리. Click 수집 on a row whose 제품명 is one of the 8 tracked products (e.g. "OpenSSL") — confirm a loading spin state briefly appears, then a success toast, and "최근 확인일" for that row updates to "오늘". Click 수집 on a row whose 제품명 is not tracked — confirm you get the "자동 수집 대상 제품이 아닙니다" toast and `checked_at` does NOT change.

- [ ] **Step 6: Commit**

```bash
git add components/pages/assets-view.tsx
git commit -m "feat: wire assets-view 수집 button to real per-product /api/collect-source call"
```

---

## Post-plan CLAUDE.md update

After all 9 tasks are committed, update `CLAUDE.md`'s "Data & state" migration table: add `admin_policies` to the list of tables in use (Supabase section), and update the `assets-view.tsx`/`admin-view.tsx` migrated-file notes to mention the edit panel, real collect action, and policy-backed toggles. This keeps the table from going stale a third time.
