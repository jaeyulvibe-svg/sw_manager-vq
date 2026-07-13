# 담당자 조치 현황(patch_tasks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give asset owners a place to register patch plans, delay reasons, and completion after a vulnerability/EOS notice is approved and assigned to them — currently the approval flow only flags the asset and sends a one-way notification with no feedback path.

**Architecture:** A new `patch_tasks` table (one row per `vulnerability_id`+`asset_id` pair) is auto-created inside the existing shared approval side-effect (`lib/notice-approval.ts`'s `flagMatchedAssetsAndNotify`), so both the manual-approve path (`notice-actions.ts`) and the server-side auto-collect path (`app/api/collect-source/route.ts`) stay in sync without duplicated logic. A new view (`patch-tasks-view.tsx`, nav key `patch-tasks`, label "내 조치 업무") lists tasks by joining `patch_tasks` with the existing `useNoticeData()` hook's `vulns`/`assets` in-memory (no new join hook needed). Since this app has no real login (`role-context.tsx` only toggles admin/owner), "my tasks" is simulated with a manual 담당자 dropdown filter sourced from `app_users`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (`@supabase/supabase-js` via `@supabase/ssr`), TypeScript, Tailwind.

## Global Constraints

- No test suite is configured in this repo (`CLAUDE.md`) — every "verify" step below is `npx tsc --noEmit` (filtered to touched files) plus a manual check, not an automated test run. Do not add a test framework as part of this plan.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true`, so `npx tsc --noEmit` is the only thing that will actually catch type errors — always run it before committing a task.
- This project has no Supabase CLI link and no DB connection string in `.env.local`. SQL migration files are applied manually by the user pasting them into the Supabase SQL editor — Task 1 ends with a manual-apply instruction, not an automated migration run.
- Follow existing code conventions exactly: Korean UI strings, `MiniButton`/`SectionCard`/`StatusBadge`/`TableShell`/`usePagination` from `@/components/portal/ui`, `useToast()` for feedback, `cn()` from `@/lib/utils`, immediate-reflect CRUD (call `supabase` directly from the client component, no separate API layer).
- Do not add: 예외요청/예외승인, 담당자 변경, 관리자 완료 확인, 증적 URL, separate columns for plan/delay-reason/completion-note (a single `note` column is reused across all three), or new notifications on task update — these are explicitly out of scope per the design doc (`docs/superpowers/specs/2026-07-14-patch-tasks-design.md`).

---

### Task 1: `patch_tasks` table + generated types

**Files:**
- Create: `supabase/migrations/015_patch_tasks.sql`
- Modify: `lib/supabase/types.ts:402-434` (insert new table block after `admin_policies`, before the closing `}` of `Tables`)

**Interfaces:**
- Produces: `Tables<"patch_tasks">` row shape — `{ id: string; vulnerability_id: string; asset_id: string; owner: string; status: "배정됨"|"조치예정"|"조치지연"|"조치완료"; due_date: string | null; note: string | null; completed_at: string | null; created_at: string; updated_at: string }`. Every later task reads/writes this via this shape.

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================
--  담당자 조치 현황 — 공지 승인 후 자산별 조치 티켓
--  (자산 하나가 여러 공지에 동시에 걸릴 수 있으므로 assets.approval이
--   아니라 이 테이블에서 (공지, 자산) 쌍 단위로 상태를 관리한다)
-- =====================================================

create sequence if not exists public.patch_task_seq;

create table if not exists public.patch_tasks (
  id                text primary key default 'PT-' || lpad(nextval('public.patch_task_seq')::text, 3, '0'),
  vulnerability_id  text not null references public.vulnerabilities(id) on delete cascade,
  asset_id          text not null references public.assets(id) on delete cascade,
  owner             text not null,
  status            text not null default '배정됨'
                      check (status in ('배정됨','조치예정','조치지연','조치완료')),
  due_date          date,
  note              text,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (vulnerability_id, asset_id)
);

drop trigger if exists patch_tasks_updated_at on public.patch_tasks;
create trigger patch_tasks_updated_at
  before update on public.patch_tasks
  for each row execute function public.set_updated_at();

alter table public.patch_tasks enable row level security;

drop policy if exists "allow_all_patch_tasks" on public.patch_tasks;
create policy "allow_all_patch_tasks" on public.patch_tasks for all using (true) with check (true);
```

- [ ] **Step 2: Add the `patch_tasks` table type to `lib/supabase/types.ts`**

Open `lib/supabase/types.ts`. Find the `admin_policies` block's closing, which currently ends the `Tables` object (lines 402-434):

```ts
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

Insert a new `patch_tasks` block right after the `admin_policies` block's closing `}`, before the `Tables` object's own closing `}`:

```ts
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
      patch_tasks: {
        Row: {
          id: string
          vulnerability_id: string
          asset_id: string
          owner: string
          status: "배정됨" | "조치예정" | "조치지연" | "조치완료"
          due_date: string | null
          note: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vulnerability_id: string
          asset_id: string
          owner: string
          status?: "배정됨" | "조치예정" | "조치지연" | "조치완료"
          due_date?: string | null
          note?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: "배정됨" | "조치예정" | "조치지연" | "조치완료"
          due_date?: string | null
          note?: string | null
          completed_at?: string | null
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
git add supabase/migrations/015_patch_tasks.sql lib/supabase/types.ts
git commit -m "feat: add patch_tasks table for owner patch/EOS action tracking"
```

- [ ] **Step 5: Tell the user to apply the migration**

Tell the user: "`015_patch_tasks.sql`을 Supabase SQL 편집기에서 실행해주세요 — 이전 마이그레이션들과 동일하게 수동 적용이 필요합니다." Do not proceed to treat the table as live until the user confirms it's applied — later tasks' manual-verification steps assume the table exists.

---

### Task 2: `lib/notice-approval.ts` auto-creates `patch_tasks` on approval

**Files:**
- Modify: `lib/notice-approval.ts`

**Interfaces:**
- Consumes: `Tables<"patch_tasks">` (Task 1).
- Produces: `flagMatchedAssetsAndNotify`'s `notice` parameter now requires `"id"` in its `Pick<Vulnerability, ...>` — Task 3 must pass an object that includes `id`.

- [ ] **Step 1: Add `"id"` to the `notice` parameter type and upsert `patch_tasks`**

Find the current `flagMatchedAssetsAndNotify` function:

```ts
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
```

Replace it with:

```ts
export async function flagMatchedAssetsAndNotify(
  supabase: SupabaseClient<Database>,
  notice: Pick<Vulnerability, "id" | "title" | "cve" | "severity" | "notice_type">,
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

  await supabase.from("patch_tasks").upsert(
    matched.map((a) => ({
      vulnerability_id: notice.id,
      asset_id: a.id,
      owner: a.owner,
    })),
    { onConflict: "vulnerability_id,asset_id", ignoreDuplicates: true },
  )

  if (notice.severity === "Critical" && !policy.criticalUrgentAlert) {
    return { notifiedCount: 0 }
  }
```

(The rest of the function body — the `notifications` insert and `return` — is unchanged.)

- [ ] **Step 2: Typecheck (expect a pre-existing error in the auto-collect caller, fixed in Task 3)**

Run: `npx tsc --noEmit -p . 2>&1 | grep "notice-approval"`
Expected: no errors from `notice-approval.ts` itself. (`app/api/collect-source/route.ts` will show a "Property 'id' is missing" error until Task 3 — that's fine, don't fix it here. `applyNoticeApproval`'s caller, `notice-actions.ts`, already passes a full `Tables<"vulnerabilities">` row that includes `id`, so it needs no change.)

- [ ] **Step 3: Commit**

```bash
git add lib/notice-approval.ts
git commit -m "feat: auto-create patch_tasks rows when a notice is approved and matched to assets"
```

---

### Task 3: `/api/collect-source` passes the inserted row's `id`

**Files:**
- Modify: `app/api/collect-source/route.ts`

**Interfaces:**
- Consumes: `flagMatchedAssetsAndNotify(supabase, notice: Pick<Vulnerability, "id"|"title"|"cve"|"severity"|"notice_type">, matched, policy)` from Task 2.

- [ ] **Step 1: Capture inserted ids by matching on `cve` (unique)**

Find, inside `collectOne`:

```ts
    const { error: insErr } = await supabase.from("vulnerabilities").insert(prepared.map((p) => p.row))
    if (insErr) throw insErr

    for (const { notice, matched, row } of prepared) {
      if (row.approval !== "승인완료") continue
      await flagMatchedAssetsAndNotify(supabase, notice, matched, policy)
    }
```

Replace with:

```ts
    const { data: insertedRows, error: insErr } = await supabase
      .from("vulnerabilities")
      .insert(prepared.map((p) => p.row))
      .select("id, cve")
    if (insErr) throw insErr

    const idByCve = new Map((insertedRows ?? []).map((r) => [r.cve, r.id]))

    for (const { notice, matched, row } of prepared) {
      if (row.approval !== "승인완료") continue
      const id = idByCve.get(row.cve)
      if (!id) continue
      await flagMatchedAssetsAndNotify(supabase, { ...notice, id }, matched, policy)
    }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "collect-source"`
Expected: no output.

- [ ] **Step 3: Manual verification**

This step requires Task 1's migration applied. Run `pnpm dev`, open 관리자 페이지, run "즉시 수집" for a product likely to return a new notice with a matched asset (e.g. "OpenSSL" if an OpenSSL asset exists and the collector finds a new CVE). If the policy auto-approves the notice (or approve it manually from "제조사 취약점 공지"), confirm a new row appears in `patch_tasks` with `status = '배정됨'` for each matched asset.

- [ ] **Step 4: Commit**

```bash
git add app/api/collect-source/route.ts
git commit -m "fix: capture inserted vulnerability ids so auto-approved notices create patch_tasks"
```

---

### Task 4: Nav wiring — `patch-tasks` view key

**Files:**
- Modify: `components/portal/nav.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `ViewKey` now includes `"patch-tasks"`. Task 5's component must be named `PatchTasksView` and accept no required props (matches how `NotificationsView`/`AssetsView` etc. are wired) — actually it needs `onNavigate` since Task 6 links back to it and it links nowhere itself for v1, so it takes no props at all.

- [ ] **Step 1: Add the `ViewKey` and nav item**

In `components/portal/nav.ts`, find the icon import block:

```ts
import {
  LayoutDashboard,
  Boxes,
  CalendarClock,
  FilePlus2,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Bell,
  Database,
  RefreshCw,
  UsersRound,
  Server,
  Megaphone,
  type LucideIcon,
} from "lucide-react"
```

Replace with (add `ListChecks`):

```ts
import {
  LayoutDashboard,
  Boxes,
  CalendarClock,
  FilePlus2,
  ClipboardCheck,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Bell,
  Database,
  RefreshCw,
  UsersRound,
  Server,
  Megaphone,
  ListChecks,
  type LucideIcon,
} from "lucide-react"
```

Find the `ViewKey` union:

```ts
export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "notice-board"
  | "request"
  | "approval"
  | "kisa"
  | "vendor"
  | "eos-notice"
  | "patch"
  | "admin-master"
  | "admin-servers"
  | "admin-collect"
  | "admin-policy"
  | "admin-users"
  | "notifications"
```

Replace with:

```ts
export type ViewKey =
  | "dashboard"
  | "assets"
  | "eos"
  | "notice-board"
  | "request"
  | "approval"
  | "kisa"
  | "vendor"
  | "eos-notice"
  | "patch"
  | "patch-tasks"
  | "admin-master"
  | "admin-servers"
  | "admin-collect"
  | "admin-policy"
  | "admin-users"
  | "notifications"
```

Find the `vuln-notice` group:

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

Replace with:

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
      { key: "patch-tasks", label: "내 조치 업무", icon: ListChecks },
    ],
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "nav.ts"`
Expected: no output.

- [ ] **Step 3: Wire the view into `app/page.tsx` (component created in Task 5 — this step will show a "Cannot find module" error until Task 5 exists; that's expected and fixed there)**

Find the import block in `app/page.tsx`:

```ts
import { PatchView } from "@/components/pages/patch-view"
import { AdminView } from "@/components/pages/admin-view"
```

Replace with:

```ts
import { PatchView } from "@/components/pages/patch-view"
import { PatchTasksView } from "@/components/pages/patch-tasks-view"
import { AdminView } from "@/components/pages/admin-view"
```

Find, inside `renderView()`:

```ts
      case "patch":
        return <PatchView onNavigate={setActive} />
      case "admin-master":
```

Replace with:

```ts
      case "patch":
        return <PatchView onNavigate={setActive} />
      case "patch-tasks":
        return <PatchTasksView />
      case "admin-master":
```

- [ ] **Step 4: Commit**

```bash
git add components/portal/nav.ts app/page.tsx
git commit -m "feat: add patch-tasks nav entry (내 조치 업무)"
```

(This commit will leave the build broken until Task 5 adds the component — that's fine for a local commit sequence executed back-to-back in this plan; do not push or stop here.)

---

### Task 5: `patch-tasks-view.tsx` — "내 조치 업무" screen

**Files:**
- Create: `components/pages/patch-tasks-view.tsx`

**Interfaces:**
- Consumes: `useNoticeData()` from `@/components/pages/notice-board/use-notice-data` (returns `{ vulns, assets, matchMap, loading, refresh }` — this task only uses `vulns`/`assets`/`loading`), `Tables<"patch_tasks">`/`Tables<"app_users">` from `@/lib/supabase/types`, `useRole` from `@/components/portal/role-context`, `useToast` from `@/components/portal/toast`.
- Produces: `PatchTasksView()` component, default-exported nothing (named export), consumed by Task 4's `app/page.tsx` wiring.

- [ ] **Step 1: Write the component**

```tsx
// components/pages/patch-tasks-view.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ListChecks,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Search,
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
  usePagination,
  Pagination,
  type Accent,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { useToast } from "@/components/portal/toast"
import { useNoticeData, sevRisk, type Vulnerability } from "@/components/pages/notice-board/use-notice-data"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type PatchTask = Tables<"patch_tasks">
type PatchTaskStatus = PatchTask["status"]
type AppUser = Tables<"app_users">
type Asset = Tables<"assets">

const STATUS_FILTERS: ("전체" | PatchTaskStatus)[] = ["전체", "배정됨", "조치예정", "조치지연", "조치완료"]
const SEVERITY_FILTERS: ("전체" | Vulnerability["severity"])[] = ["전체", "Critical", "High", "Medium", "Low"]
const EDIT_STATUS_OPTIONS: PatchTaskStatus[] = ["조치예정", "조치지연", "조치완료"]

const statusAccent: Record<PatchTaskStatus, Accent> = {
  배정됨: "muted",
  조치예정: "primary",
  조치지연: "warning",
  조치완료: "success",
}

type Row = { task: PatchTask; vulnerability: Vulnerability; asset: Asset }

type EditValues = { status: PatchTaskStatus; due_date: string; note: string }

function EditPanel({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: EditValues
  onCancel: () => void
  onSubmit: (values: EditValues) => void
}) {
  const [values, setValues] = useState<EditValues>(initial)
  const inputCls =
    "rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        <select
          value={values.status}
          onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as PatchTaskStatus }))}
          className={inputCls}
        >
          {EDIT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">기한</span>
        <input
          type="date"
          value={values.due_date}
          onChange={(e) => setValues((v) => ({ ...v, due_date: e.target.value }))}
          className={inputCls}
        />
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">메모 (계획/지연사유/조치내용)</span>
        <textarea
          value={values.note}
          onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
          rows={2}
          className={cn(inputCls, "resize-none")}
        />
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

export function PatchTasksView() {
  const { isAdmin } = useRole()
  const { toast } = useToast()
  const { vulns, assets, loading: noticeLoading } = useNoticeData()
  const [tasks, setTasks] = useState<PatchTask[]>([])
  const [owners, setOwners] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("전체")
  const [statusFilter, setStatusFilter] = useState<"전체" | PatchTaskStatus>("전체")
  const [severityFilter, setSeverityFilter] = useState<"전체" | Vulnerability["severity"]>("전체")
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("patch_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTasks(data)
        setLoading(false)
      })
    supabase
      .from("app_users")
      .select("*")
      .eq("role", "담당자")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setOwners(data)
      })
  }, [])

  const vulnMap = useMemo(() => new Map(vulns.map((v) => [v.id, v])), [vulns])
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const task of tasks) {
      const vulnerability = vulnMap.get(task.vulnerability_id)
      const asset = assetMap.get(task.asset_id)
      if (vulnerability && asset) out.push({ task, vulnerability, asset })
    }
    return out
  }, [tasks, vulnMap, assetMap])

  const filtered = rows.filter(({ task, vulnerability }) => {
    const q = query.trim().toLowerCase()
    if (q && ![vulnerability.title, vulnerability.cve].some((f) => f.toLowerCase().includes(q))) return false
    if (ownerFilter !== "전체" && task.owner !== ownerFilter) return false
    if (statusFilter !== "전체" && task.status !== statusFilter) return false
    if (severityFilter !== "전체" && vulnerability.severity !== severityFilter) return false
    return true
  })

  const stats = useMemo(
    () => ({
      total: rows.length,
      scheduled: rows.filter((r) => r.task.status === "조치예정").length,
      delayed: rows.filter((r) => r.task.status === "조치지연").length,
      done: rows.filter((r) => r.task.status === "조치완료").length,
    }),
    [rows],
  )

  const pagination = usePagination(filtered)

  async function saveTask(taskId: string, values: EditValues) {
    const supabase = createClient()
    const patch = {
      status: values.status,
      due_date: values.due_date || null,
      note: values.note || null,
      completed_at: values.status === "조치완료" ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from("patch_tasks").update(patch).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "저장 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
    setEditId(null)
    toast({ tone: "success", title: "조치 내용이 저장되었습니다" })
  }

  const isLoading = loading || noticeLoading

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ListChecks}
        title="내 조치 업무"
        description="승인된 취약점·EOS 공지에서 배정된 자산별 조치 건을 확인하고 계획·지연사유·완료를 등록합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 배정" value={stats.total} icon={ClipboardList} accent="primary" delay={80} />
        <StatCard label="조치예정" value={stats.scheduled} icon={CalendarClock} accent="primary" delay={160} />
        <StatCard label="조치지연" value={stats.delayed} icon={AlertTriangle} accent="warning" delay={240} />
        <StatCard label="조치완료" value={stats.done} icon={CheckCircle2} accent="success" delay={320} />
      </div>

      <SectionCard title="조치 목록" subtitle="공지 승인 시 매칭된 자산마다 자동 생성됩니다" icon={ListChecks}>
        <div className="mb-4 flex flex-col gap-3 border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); pagination.setPage(1) }}
                placeholder="제목, CVE 검색"
                className="w-full rounded-lg border border-border/60 bg-background/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">담당자</span>
            <select
              value={ownerFilter}
              onChange={(e) => { setOwnerFilter(e.target.value); pagination.setPage(1) }}
              className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
            >
              <option value="전체">전체</option>
              {owners.map((o) => (
                <option key={o.id} value={o.name}>{o.name}</option>
              ))}
            </select>
            {!isAdmin ? (
              <span className="text-[11px] text-muted-foreground">
                실제 로그인이 없어 본인 이름을 선택하면 "조치 등록" 버튼이 활성화됩니다.
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">상태</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setStatusFilter(s); pagination.setPage(1) }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">심각도</span>
            {SEVERITY_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSeverityFilter(s); pagination.setPage(1) }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  severityFilter === s ? "border-primary/50 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          총 <span className="font-mono font-semibold text-foreground">{filtered.length}</span>건
          {isLoading && <span className="ml-2 text-xs">불러오는 중…</span>}
        </p>

        <TableShell scrollHint>
          <thead>
            <tr>
              <Th>심각도</Th>
              <Th>CVE</Th>
              <Th>제품명</Th>
              <Th>서버명</Th>
              <Th>담당자</Th>
              <Th>상태</Th>
              <Th>기한</Th>
              <Th>메모</Th>
              <Th>관리</Th>
            </tr>
          </thead>
          <tbody>
            {pagination.pageItems.map(({ task, vulnerability, asset }) => {
              const canEdit = !isAdmin && ownerFilter !== "전체"
              if (editId === task.id) {
                return (
                  <tr key={task.id}>
                    <td colSpan={9} className="border-b border-border/40 p-0">
                      <EditPanel
                        initial={{
                          status: EDIT_STATUS_OPTIONS.includes(task.status as (typeof EDIT_STATUS_OPTIONS)[number])
                            ? (task.status as EditValues["status"])
                            : "조치예정",
                          due_date: task.due_date ?? "",
                          note: task.note ?? "",
                        }}
                        onCancel={() => setEditId(null)}
                        onSubmit={(values) => saveTask(task.id, values)}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={task.id} className="transition-colors hover:bg-accent/40">
                  <Td>
                    <StatusBadge risk={sevRisk[vulnerability.severity]} pulse={vulnerability.severity === "Critical"}>
                      {vulnerability.severity}
                    </StatusBadge>
                  </Td>
                  <Td className="font-mono text-xs">{vulnerability.cve}</Td>
                  <Td className="text-xs">{vulnerability.product}</Td>
                  <Td className="text-xs text-muted-foreground">{asset.server}</Td>
                  <Td className="text-xs">{task.owner}</Td>
                  <Td>
                    <StatusBadge accent={statusAccent[task.status]}>{task.status}</StatusBadge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{task.due_date ?? "-"}</Td>
                  <Td className="max-w-xs truncate text-xs text-muted-foreground">{task.note ?? "-"}</Td>
                  <Td>
                    {canEdit ? (
                      <MiniButton accent="primary" onClick={() => setEditId(task.id)}>
                        조치 등록
                      </MiniButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </Td>
                </tr>
              )
            })}
            {!isLoading && pagination.pageItems.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "patch-tasks-view"`
Expected: no output.

- [ ] **Step 3: Typecheck the whole project (Tasks 4+5 combined should now be clean)**

Run: `npx tsc --noEmit -p .`
Expected: no output (both `app/page.tsx`'s "Cannot find module" from Task 4 and any remaining errors should be gone now).

- [ ] **Step 4: Manual verification**

Requires Task 1's migration applied and at least one `patch_tasks` row (created by approving a notice with a matched asset, per Task 2/3's verification). Run `pnpm dev`:
1. Open "내 조치 업무" (아래 취약점 공지 그룹) — confirm the row(s) show up with 심각도/CVE/제품명/서버명/담당자/상태(`배정됨`) and the summary cards show correct counts.
2. Toggle role to 담당자 (owner) via the header role toggle — confirm "조치 등록" is hidden until you pick a 담당자 in the filter dropdown that matches the row's 담당자, then confirm it appears only for rows with that owner.
3. Click "조치 등록", pick 상태 `조치예정`, set a 기한, type a 메모, save — confirm the row updates immediately and a success toast appears. Refresh the page — confirm the change persisted.
4. Repeat with 상태 `조치완료` — confirm `completed_at` gets set (check in Supabase table editor) and the badge turns success-green.
5. Toggle role back to 관리자 — confirm 전체 목록이 그대로 보이고 "조치 등록" 버튼이 어디에도 없는지 확인.

- [ ] **Step 5: Commit**

```bash
git add components/pages/patch-tasks-view.tsx
git commit -m "feat: add 내 조치 업무 (patch-tasks) view for owner plan/delay/completion feedback"
```

---

### Task 6: `patch-view.tsx` — status badges + shortcut to "내 조치 업무"

**Files:**
- Modify: `components/pages/patch-view.tsx`

**Interfaces:**
- Consumes: `Tables<"patch_tasks">` (Task 1), `patch-tasks` `ViewKey` (Task 4).

- [ ] **Step 1: Add imports and a `patch_tasks` status lookup**

Find the top of the file:

```ts
import { Fragment, useMemo, useState } from "react"
```

Replace with:

```ts
import { Fragment, useEffect, useMemo, useState } from "react"
```

Find:

```ts
import { useNoticeData, sevRisk, formatCollected, type Vulnerability } from "@/components/pages/notice-board/use-notice-data"
import type { ViewKey } from "@/components/portal/nav"
import { cn } from "@/lib/utils"
```

Replace with:

```ts
import { useNoticeData, sevRisk, formatCollected, type Vulnerability } from "@/components/pages/notice-board/use-notice-data"
import type { ViewKey } from "@/components/portal/nav"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type PatchTaskStatus = Tables<"patch_tasks">["status"]

const taskStatusAccent: Record<PatchTaskStatus, Accent> = {
  배정됨: "muted",
  조치예정: "primary",
  조치지연: "warning",
  조치완료: "success",
}
```

- [ ] **Step 2: Fetch the status map**

Find, inside `PatchView`:

```ts
  const { vulns, matchMap, loading } = useNoticeData()
  const [query, setQuery] = useState("")
```

Replace with:

```ts
  const { vulns, matchMap, loading } = useNoticeData()
  const [taskStatusMap, setTaskStatusMap] = useState<Map<string, PatchTaskStatus>>(new Map())
  const [query, setQuery] = useState("")
```

Find the `expandedId` state line:

```ts
  const [expandedId, setExpandedId] = useState<string | null>(null)
```

Add right after it:

```ts
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("patch_tasks")
      .select("vulnerability_id, asset_id, status")
      .then(({ data }) => {
        if (data) {
          setTaskStatusMap(new Map(data.map((t) => [`${t.vulnerability_id}:${t.asset_id}`, t.status])))
        }
      })
  }, [])
```

- [ ] **Step 3: Show a status badge per matched asset in the expanded row**

Find:

```tsx
                        {matched.length > 0 ? (
                          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {matched.map((a) => (
                              <li key={a.id} className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
                                <span className="font-mono">{a.id}</span> · {a.name} · {a.server} · {a.owner}
                              </li>
                            ))}
                          </ul>
                        ) : (
```

Replace with:

```tsx
                        {matched.length > 0 ? (
                          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {matched.map((a) => {
                              const taskStatus = taskStatusMap.get(`${v.id}:${a.id}`)
                              return (
                                <li key={a.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
                                  <span className="font-mono">{a.id}</span> · {a.name} · {a.server} · {a.owner}
                                  {taskStatus ? (
                                    <StatusBadge accent={taskStatusAccent[taskStatus]}>{taskStatus}</StatusBadge>
                                  ) : null}
                                </li>
                              )
                            })}
                          </ul>
                        ) : (
```

- [ ] **Step 4: Add a shortcut button to "내 조치 업무"**

Find the `PageHeader` action prop:

```tsx
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
```

Replace with:

```tsx
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
              <MiniButton accent="success" onClick={() => onNavigate("patch-tasks")}>
                내 조치 업무 바로가기<ArrowRight className="h-3 w-3" />
              </MiniButton>
            </div>
          ) : undefined
        }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "patch-view"`
Expected: no output.

- [ ] **Step 6: Manual verification**

Run `pnpm dev`, open "승인된 취약점 공지", expand "매핑 자산" on an approved notice that has a `patch_tasks` row — confirm the status badge (e.g. `배정됨`) shows next to the asset. Click "내 조치 업무 바로가기" — confirm it navigates to the new screen.

- [ ] **Step 7: Commit**

```bash
git add components/pages/patch-view.tsx
git commit -m "feat: show per-asset patch-task status and link to 내 조치 업무 from 승인된 취약점 공지"
```

---

## Post-plan CLAUDE.md update

After all 6 tasks are committed, update `CLAUDE.md`'s "Data & state" migration table: add `patch_tasks` to the list of Supabase tables in use, and add a note describing the new `patch-tasks-view.tsx` (자동 생성되는 자산별 조치 티켓, 담당자 필터로 신원 시뮬레이션, 조치예정/조치지연/조치완료 등록) and the small addition to `patch-view.tsx` (상태 배지 + 바로가기). This keeps the migration table from going stale again — it's already been flagged as stale twice.
