# DEMO 데이터 초기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a "DEMO 데이터 설정" screen where a single button restores 11 sample-data tables back to a saved baseline, so this demo app can be reset to a known-good state between demos without engineering help.

**Architecture:** A new `demo_snapshots` table (single row, `id='default'`) stores the whole baseline as one jsonb blob (`{ "assets": [...], "servers": [...], ... }`). Two Postgres functions do the heavy lifting so both actions are atomic single-transaction calls from the browser client: `save_demo_snapshot()` re-captures all 11 tables' current rows into that blob (called once by the migration itself, so "whatever is in the DB right now" becomes the first baseline — and again later from the UI's "새 기준으로 저장" button), and `reset_demo_data()` deletes and re-inserts all 11 tables from the stored blob (called by the UI's "초기화" button). `admin_policies` is deliberately excluded — it's operational config, not sample data. A new page component (`demo-data-view.tsx`, nav key `admin-demo`) wraps both actions behind `ConfirmDialog`, matching the existing destructive-action pattern in `admin-view.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (`@supabase/supabase-js` via `@supabase/ssr`), TypeScript, Tailwind.

## Global Constraints

- No test suite is configured (`CLAUDE.md`) — every "verify" step is `npx tsc --noEmit -p .` plus manual clicking, not an automated test run. Do not add a test framework.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true`, so `npx tsc --noEmit` is the only thing that actually catches type errors — run it before every commit.
- This project has no Supabase CLI link — migrations are applied manually by the user pasting the SQL file into the Supabase SQL editor. Task 1 ends with a manual-apply instruction; don't treat `demo_snapshots`/the two RPC functions as live until the user confirms.
- All 11 tables (`assets`, `servers`, `vulnerabilities`, `asset_requests`, `notifications`, `notices`, `licenses`, `sw_masters`, `sources`, `app_users`, `patch_tasks`) already have permissive `allow_all` RLS policies, so the browser (anon-key) client can already call `supabase.rpc(...)` for both functions — no service-role route needed.
- `licenses.asset_id` and `patch_tasks.{vulnerability_id,asset_id}` are real foreign keys with `on delete cascade` (see `supabase/migrations/005_licenses.sql`, `015_patch_tasks.sql`). `reset_demo_data()` MUST delete `patch_tasks`/`licenses` before their parent tables and insert them after — get this order wrong and the migration will fail with an FK violation.
- Follow existing conventions: Korean UI strings, `PageHeader`/`SectionCard`/`MiniButton`/`ConfirmDialog`/`StatusBadge` from `@/components/portal/ui`, `useToast()` for feedback, `cn()` from `@/lib/utils`, direct `supabase` calls from client components (no API route layer).
- Do not build: snapshot history/versioning, a UI toggle for including `admin_policies`, or a UI for customizing which tables are included — all explicitly out of scope per `docs/superpowers/specs/2026-07-14-demo-data-reset-design.md`.

---

### Task 1: `demo_snapshots` table + `save_demo_snapshot()`/`reset_demo_data()` functions

**Files:**
- Create: `supabase/migrations/016_demo_snapshots.sql`
- Modify: `lib/supabase/types.ts:434-472` (insert `demo_snapshots` table block after `patch_tasks`, before `Tables`'s closing `}`; replace `Functions: Record<string, never>` with the two RPC signatures)

**Interfaces:**
- Produces: `Tables<"demo_snapshots">` row shape — `{ id: string; data: Json; captured_at: string; updated_at: string }`. Task 3 reads this via `supabase.from("demo_snapshots").select("*").eq("id","default").maybeSingle()`.
- Produces: `supabase.rpc("save_demo_snapshot")` and `supabase.rpc("reset_demo_data")` — both zero-arg, `Returns: undefined`. Task 3 calls both directly from the browser client.

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================
--  DEMO 데이터 스냅샷 — 시연용 샘플 데이터를 기준 상태로
--  저장/복원하기 위한 테이블 + 함수 2개
--  (admin_policies는 운영 설정으로 보고 스냅샷/복원 대상에서 제외)
-- =====================================================

create table if not exists public.demo_snapshots (
  id          text primary key default 'default',
  data        jsonb not null,
  captured_at timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.demo_snapshots enable row level security;

drop policy if exists "allow_all_demo_snapshots" on public.demo_snapshots;
create policy "allow_all_demo_snapshots" on public.demo_snapshots for all using (true) with check (true);

-- ─── 현재 데이터를 기준 스냅샷으로 저장 ───────────────
create or replace function public.save_demo_snapshot()
returns void language plpgsql security definer as $$
begin
  insert into public.demo_snapshots (id, data, captured_at, updated_at)
  values (
    'default',
    jsonb_build_object(
      'servers',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.servers t),
      'sw_masters',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sw_masters t),
      'sources',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sources t),
      'app_users',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_users t),
      'assets',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.assets t),
      'vulnerabilities', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.vulnerabilities t),
      'asset_requests',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.asset_requests t),
      'notifications',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notifications t),
      'notices',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notices t),
      'licenses',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.licenses t),
      'patch_tasks',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.patch_tasks t)
    ),
    now(), now()
  )
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

grant execute on function public.save_demo_snapshot() to anon, authenticated;

-- ─── 기준 스냅샷으로 복원 ──────────────────────────────
create or replace function public.reset_demo_data()
returns void language plpgsql security definer as $$
declare
  snap jsonb;
begin
  select data into snap from public.demo_snapshots where id = 'default';
  if snap is null then
    raise exception 'demo snapshot not found — call save_demo_snapshot() first';
  end if;

  -- FK로 참조하는 자식 테이블부터 삭제 (licenses/patch_tasks → assets/vulnerabilities, on delete cascade)
  delete from public.patch_tasks;
  delete from public.licenses;
  delete from public.notifications;
  delete from public.asset_requests;
  delete from public.notices;
  delete from public.vulnerabilities;
  delete from public.assets;
  delete from public.servers;
  delete from public.sw_masters;
  delete from public.sources;
  delete from public.app_users;

  -- 참조 대상(부모)부터 복원
  insert into public.servers    select * from jsonb_populate_recordset(null::public.servers,    snap->'servers');
  insert into public.sw_masters select * from jsonb_populate_recordset(null::public.sw_masters,  snap->'sw_masters');
  insert into public.sources    select * from jsonb_populate_recordset(null::public.sources,     snap->'sources');
  insert into public.app_users  select * from jsonb_populate_recordset(null::public.app_users,   snap->'app_users');
  insert into public.assets          select * from jsonb_populate_recordset(null::public.assets,          snap->'assets');
  insert into public.vulnerabilities select * from jsonb_populate_recordset(null::public.vulnerabilities, snap->'vulnerabilities');
  insert into public.asset_requests select * from jsonb_populate_recordset(null::public.asset_requests, snap->'asset_requests');
  insert into public.notifications  select * from jsonb_populate_recordset(null::public.notifications,  snap->'notifications');
  insert into public.notices        select * from jsonb_populate_recordset(null::public.notices,        snap->'notices');
  -- 자식 테이블 마지막
  insert into public.licenses    select * from jsonb_populate_recordset(null::public.licenses,    snap->'licenses');
  insert into public.patch_tasks select * from jsonb_populate_recordset(null::public.patch_tasks, snap->'patch_tasks');
end;
$$;

grant execute on function public.reset_demo_data() to anon, authenticated;

-- ─── 최초 기준 스냅샷 저장: 이 마이그레이션 적용 시점의 실데이터를 그대로 기준으로 삼는다 ───
select public.save_demo_snapshot();
```

- [ ] **Step 2: Add the `demo_snapshots` table type to `lib/supabase/types.ts`**

Find the `patch_tasks` block's closing (currently the last table, right before `Tables`'s closing `}`):

```ts
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
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
```

Replace with:

```ts
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
      demo_snapshots: {
        Row: {
          id: string
          data: Json
          captured_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          data: Json
          captured_at?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          captured_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      save_demo_snapshot: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_demo_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: Record<string, never>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "lib/supabase/types.ts"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_demo_snapshots.sql lib/supabase/types.ts
git commit -m "feat: add demo_snapshots table and save/reset RPC functions for DEMO data reset"
```

- [ ] **Step 5: Tell the user to apply the migration**

Tell the user: "`016_demo_snapshots.sql`을 Supabase SQL 편집기에서 실행해주세요 — 이전 마이그레이션들과 동일하게 수동 적용이 필요합니다. 이 마이그레이션은 실행되는 시점의 현재 데이터를 그대로 최초 기준(baseline)으로 저장합니다." Do not proceed to treat `demo_snapshots` as populated until the user confirms — Task 3's manual-verification steps assume a baseline already exists.

---

### Task 2: Nav wiring — `admin-demo` view key

**Files:**
- Modify: `components/portal/nav.ts`

**Interfaces:**
- Produces: `ViewKey` now includes `"admin-demo"`. Task 3's component must be named `DemoDataView` and take no props (matches `ServersView`/`SwMasterView`).

- [ ] **Step 1: Add the icon import**

Find:

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

Replace with (add `RotateCcw`):

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
  RotateCcw,
  type LucideIcon,
} from "lucide-react"
```

- [ ] **Step 2: Add the `ViewKey`**

Find:

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
  | "admin-demo"
  | "notifications"
```

- [ ] **Step 3: Add the nav item to the `admin` group**

Find:

```ts
  {
    groupKey: "admin",
    label: "관리자 페이지",
    icon: Settings,
    adminOnly: true,
    children: [
      { key: "admin-master", label: "SW 마스터 관리", icon: Database },
      { key: "admin-servers", label: "서버 관리", icon: Server },
      { key: "admin-collect", label: "수집 관리", icon: RefreshCw },
      { key: "admin-policy", label: "승인 정책", icon: ShieldCheck },
      { key: "admin-users", label: "사용자 관리", icon: UsersRound },
    ],
  },
```

Replace with:

```ts
  {
    groupKey: "admin",
    label: "관리자 페이지",
    icon: Settings,
    adminOnly: true,
    children: [
      { key: "admin-master", label: "SW 마스터 관리", icon: Database },
      { key: "admin-servers", label: "서버 관리", icon: Server },
      { key: "admin-collect", label: "수집 관리", icon: RefreshCw },
      { key: "admin-policy", label: "승인 정책", icon: ShieldCheck },
      { key: "admin-users", label: "사용자 관리", icon: UsersRound },
      { key: "admin-demo", label: "DEMO 데이터 설정", icon: RotateCcw },
    ],
  },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no output. `nav.ts` is self-contained — nothing else references `"admin-demo"` yet, so this change alone can't introduce an error (Task 3 adds the `app/page.tsx` case that actually uses it).

- [ ] **Step 5: Commit**

```bash
git add components/portal/nav.ts
git commit -m "feat: add admin-demo nav entry (DEMO 데이터 설정)"
```

---

### Task 3: `demo-data-view.tsx` — "DEMO 데이터 설정" screen

**Files:**
- Create: `components/pages/demo-data-view.tsx`
- Modify: `app/page.tsx`
- Modify: `CLAUDE.md` (migration-status table + tables-in-use list)

**Interfaces:**
- Consumes: `Tables<"demo_snapshots">` (Task 1), `admin-demo` `ViewKey` (Task 2), `PageHeader`/`SectionCard`/`MiniButton`/`ConfirmDialog`/`StatusBadge` from `@/components/portal/ui`, `useToast` from `@/components/portal/toast`, `createClient` from `@/lib/supabase/client`.
- Produces: `DemoDataView()` component (named export, no props), consumed by `app/page.tsx`.

- [ ] **Step 1: Write the component**

```tsx
// components/pages/demo-data-view.tsx
"use client"

import { useEffect, useState } from "react"
import { RotateCcw, Save, AlertTriangle } from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  MiniButton,
  ConfirmDialog,
} from "@/components/portal/ui"
import { useToast } from "@/components/portal/toast"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"

type DemoSnapshot = Tables<"demo_snapshots">

const INCLUDED_TABLES: { key: string; label: string }[] = [
  { key: "assets", label: "자산 목록" },
  { key: "servers", label: "서버" },
  { key: "vulnerabilities", label: "취약점 공지" },
  { key: "asset_requests", label: "신규 자산 요청" },
  { key: "notifications", label: "알림" },
  { key: "notices", label: "공지사항" },
  { key: "licenses", label: "라이선스" },
  { key: "sw_masters", label: "SW 마스터" },
  { key: "sources", label: "Source URL" },
  { key: "app_users", label: "사용자" },
  { key: "patch_tasks", label: "조치 업무" },
]

function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return "저장된 기준 없음"
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DemoDataView() {
  const { toast } = useToast()
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmKind, setConfirmKind] = useState<"save" | "reset" | null>(null)

  function loadSnapshot() {
    const supabase = createClient()
    supabase
      .from("demo_snapshots")
      .select("*")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        setSnapshot(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadSnapshot()
  }, [])

  async function handleSave() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("save_demo_snapshot")
    setBusy(false)
    setConfirmKind(null)
    if (error) {
      toast({ tone: "danger", title: "기준 저장 실패", description: error.message })
      return
    }
    toast({ tone: "success", title: "현재 데이터가 새 기준으로 저장되었습니다" })
    loadSnapshot()
  }

  async function handleReset() {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.rpc("reset_demo_data")
    if (error) {
      setBusy(false)
      setConfirmKind(null)
      toast({ tone: "danger", title: "초기화 실패", description: error.message })
      return
    }
    toast({ tone: "success", title: "샘플 데이터가 기준 상태로 초기화되었습니다" })
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={RotateCcw}
        title="DEMO 데이터 설정"
        description="시연 중 바뀐 데이터를 저장된 기준 상태로 되돌립니다. 기준은 언제든 현재 데이터로 다시 저장할 수 있습니다."
      />

      <SectionCard
        title="기준 스냅샷"
        subtitle={loading ? "불러오는 중..." : `마지막 기준 저장: ${formatTimestamp(snapshot?.captured_at)}`}
        icon={RotateCcw}
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">포함되는 데이터 (11개 테이블)</p>
            <div className="flex flex-wrap gap-1.5">
              {INCLUDED_TABLES.map((t) => (
                <StatusBadge key={t.key} accent="muted">{t.label}</StatusBadge>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              관리자 정책(자동수집/승인 정책 설정)은 포함되지 않습니다 — 초기화해도 그대로 유지됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
            <MiniButton accent="primary" onClick={() => setConfirmKind("save")} disabled={busy}>
              <Save className="h-3.5 w-3.5" />
              현재 데이터를 새 기준으로 저장
            </MiniButton>
            <MiniButton accent="destructive" onClick={() => setConfirmKind("reset")} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5" />
              샘플 데이터 초기화
            </MiniButton>
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirmKind === "save"}
        title="현재 데이터를 새 기준으로 저장할까요?"
        description="지금 저장돼 있는 기준 스냅샷을 덮어씁니다. 이전 기준으로는 다시 되돌릴 수 없습니다."
        confirmLabel="새 기준으로 저장"
        tone="default"
        onConfirm={handleSave}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind === "reset"}
        title="샘플 데이터를 초기화할까요?"
        description="자산·취약점 공지·알림 등 11개 테이블의 모든 데이터가 삭제되고 저장된 기준 데이터로 교체됩니다. 되돌릴 수 없습니다."
        confirmLabel="초기화"
        tone="danger"
        onConfirm={handleReset}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Wire the view into `app/page.tsx`**

Find the import block:

```ts
import { AdminView } from "@/components/pages/admin-view"
import { SwMasterView } from "@/components/pages/sw-master-view"
import { ServersView } from "@/components/pages/servers-view"
import { NotificationsView } from "@/components/pages/notifications-view"
```

Replace with:

```ts
import { AdminView } from "@/components/pages/admin-view"
import { SwMasterView } from "@/components/pages/sw-master-view"
import { ServersView } from "@/components/pages/servers-view"
import { DemoDataView } from "@/components/pages/demo-data-view"
import { NotificationsView } from "@/components/pages/notifications-view"
```

Find, inside `renderView()`:

```ts
      case "admin-users":
        return <AdminView key={active} initialTab="users" />
      case "notifications":
```

Replace with:

```ts
      case "admin-users":
        return <AdminView key={active} initialTab="users" />
      case "admin-demo":
        return <DemoDataView />
      case "notifications":
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no output (this should now be fully clean — Task 2's dangling `admin-demo` case is filled in).

- [ ] **Step 4: Manual verification**

Requires Task 1's migration applied (so `demo_snapshots` already has a baseline row). Run `pnpm dev`:
1. Open 관리자 페이지 → "DEMO 데이터 설정" — confirm "마지막 기준 저장: ..." shows a real timestamp (not "저장된 기준 없음") and all 11 table badges render.
2. Go to another screen (e.g. "자산 목록") and change something — e.g. edit an asset's 담당자, or mark a notification read, or approve a pending request.
3. Return to "DEMO 데이터 설정", click "샘플 데이터 초기화" → confirm the danger dialog appears with the full warning text → confirm. The page should reload.
4. After reload, confirm the change from step 2 is gone (asset 담당자 back to original, notification unread again, request back to 승인대기, etc).
5. Make a different change, then click "현재 데이터를 새 기준으로 저장" → confirm the (non-danger) dialog → confirm. Confirm the "마지막 기준 저장" timestamp updates to now.
6. Make another change, click "샘플 데이터 초기화" again → confirm the app now restores to the state from step 5 (the *new* baseline), not the original migration-time baseline.
7. Toggle role to 사용자(user) via the header role switch — confirm "관리자 페이지" (and therefore "DEMO 데이터 설정") disappears from the sidebar entirely.
8. In Supabase's table editor, confirm `admin_policies`'s single row is untouched by the reset in step 3/6 (toggle one of its booleans first, then reset, then confirm it's still your toggled value).

- [ ] **Step 5: Update `CLAUDE.md`**

In the "Migrated" bullet list under "Data & state", add a new clause after the `patch-tasks-view.tsx` description (before the closing `.` and `and the presentational dashboard widgets...` clause) documenting the new view:

```
`demo-data-view.tsx` ("DEMO 데이터 설정" nav entry, `demo_snapshots` table + `save_demo_snapshot()`/`reset_demo_data()` Postgres RPC functions) — 시연용 샘플 데이터를 저장된 기준 상태로 즉시 복원하는 관리자 전용 화면. `assets`/`servers`/`vulnerabilities`/`asset_requests`/`notifications`/`notices`/`licenses`/`sw_masters`/`sources`/`app_users`/`patch_tasks` 11개 테이블만 대상이며 `admin_policies`는 운영 설정으로 보고 제외; "초기화"는 `reset_demo_data()` RPC 한 번으로 11개 테이블을 원자적으로 delete+insert한 뒤 전체 페이지를 새로고침, "현재 데이터를 새 기준으로 저장"은 `save_demo_snapshot()` RPC로 기준 스냅샷을 갱신
```

Also add `demo_snapshots` to the "Tables actually in use" list near the end of the file (in the sentence listing table names, alongside `patch_tasks`).

- [ ] **Step 6: Commit**

```bash
git add components/pages/demo-data-view.tsx app/page.tsx CLAUDE.md
git commit -m "feat: add DEMO 데이터 설정 screen to reset sample data to a saved baseline"
```

---

## Post-plan check

After all 3 tasks are committed and the user has applied `016_demo_snapshots.sql`, do one final end-to-end run of Task 3 Step 4's manual verification list before considering this done — it's the only real correctness signal this repo has for a change this wide (11 tables touched at once).
